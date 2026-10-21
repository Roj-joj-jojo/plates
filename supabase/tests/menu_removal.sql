-- Rollback-only synthetic metadata. No Storage, image bytes, worker ownership or Auth deletion.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.removal_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Menu removal assertion: %',label; end if; end $$;
create function pg_temp.removal_expect(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;
create function pg_temp.removal_actor(actor uuid,kind text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform set_config('request.jwt.claim.role',kind,true);
end $$;
create temporary table removal_ids(label text primary key,id uuid);
grant select,insert on removal_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into removal_ids values('author_auth',gen_random_uuid()),('reader_auth',gen_random_uuid()),('other_auth',gen_random_uuid());
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'removal-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Menu removal fixture"}' from removal_ids;
insert into removal_ids select replace(i.label,'_auth','_profile'),l.profile_id from removal_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Removal'||left(replace(id::text,'-',''),20) from removal_ids where label like '%_profile';
select pg_temp.removal_assert(not has_function_privilege('anon','public.set_menu_item_removed(text,uuid,boolean,bigint)','EXECUTE'),'anonymous cannot remove');
select pg_temp.removal_assert(not has_function_privilege('service_role','public.set_menu_item_removed(text,uuid,boolean,bigint)','EXECUTE'),'worker cannot remove');
select pg_temp.removal_assert(not has_column_privilege('authenticated','public.menu_plate_saves','removed_at','UPDATE'),'no direct Plate removal update');
select pg_temp.removal_assert(not has_column_privilege('authenticated','public.menu_request_saves','removed_at','UPDATE'),'no direct Request removal update');

select pg_temp.removal_actor(null,'service_role');
do $$ declare intent uuid; asset uuid; author uuid:=(select id from removal_ids where label='author_profile');
begin
  for i in 1..2 loop
    intent:=gen_random_uuid(); asset:=gen_random_uuid();
    insert into public.media_upload_intents(id,uploader_id,staged_path,state) values(intent,author,author::text||'/'||intent::text,'processing');
    perform public.finish_plate_upload(intent,asset,asset::text||'.webp',640,480);
    insert into removal_ids values('asset_'||i,asset);
  end loop;
end $$;
select pg_temp.removal_actor((select id from removal_ids where label='author_auth'));
set local role authenticated;
insert into removal_ids values('plate',public.publish_plate((select id from public.categories where slug='meal'),'Removal searchable recipe','[]','[]',array(select id from removal_ids where label like 'asset_%' order by label)));
insert into removal_ids values('table',public.create_table_with_members('Removal fixture Table',array[(select id from removal_ids where label='reader_profile'),(select id from removal_ids where label='other_profile')]));
insert into removal_ids values('request',public.post_table_request((select id from removal_ids where label='table'),gen_random_uuid(),'Removal searchable question'));
insert into removal_ids values('author_request_save',public.save_table_request((select id from removal_ids where label='request')));
reset role;
select pg_temp.removal_actor((select id from removal_ids where label='reader_auth'));
set local role authenticated;
insert into removal_ids values('request_save',public.save_table_request((select id from removal_ids where label='request')));
insert into removal_ids select 'gallery_'||image_position,job_id from public.request_menu_gallery((select id from removal_ids where label='plate'),1);
reset role;
do $$ declare job public.menu_preview_jobs%rowtype; asset uuid;
begin
  for job in select j.* from public.menu_preview_jobs j join removal_ids i on i.id=j.id where i.label like 'gallery_%' loop
    asset:=gen_random_uuid();
    insert into public.menu_preview_assets(id,job_id,saver_id,plate_id,source_asset_id,source_revision,bucket_id,object_path,width,height)
      values(asset,job.id,job.saver_id,job.plate_id,job.source_asset_id,job.source_revision,'menu-previews',job.saver_id::text||'/'||asset::text||'.webp',640,480);
    update public.menu_preview_jobs set state='ready',preview_asset_id=asset where id=job.id;
  end loop;
end $$;
insert into removal_ids select 'preview',preview_asset_id from public.menu_preview_jobs where id=(select id from removal_ids where label='gallery_0');
set local role authenticated;
insert into removal_ids values('plate_save',public.save_plate((select id from removal_ids where label='plate'),1,null,(select id from removal_ids where label='preview')));
reset role;
-- A second person's legacy saved photo remains independent.
select pg_temp.removal_actor((select id from removal_ids where label='other_auth'));
set local role authenticated;
insert into removal_ids values('other_job',public.request_menu_preview((select id from removal_ids where label='plate'),1));
reset role;
do $$ declare job public.menu_preview_jobs%rowtype; asset uuid:=gen_random_uuid();
begin
  select * into job from public.menu_preview_jobs where id=(select id from removal_ids where label='other_job');
  insert into public.menu_preview_assets(id,job_id,saver_id,plate_id,source_asset_id,source_revision,bucket_id,object_path,width,height)
    values(asset,job.id,job.saver_id,job.plate_id,job.source_asset_id,job.source_revision,'menu-previews',job.saver_id::text||'/'||asset::text||'.webp',640,480);
  update public.menu_preview_jobs set state='ready',preview_asset_id=asset where id=job.id;
  insert into removal_ids values('other_preview',asset);
end $$;
set local role authenticated;
insert into removal_ids values('other_plate_save',public.save_plate((select id from removal_ids where label='plate'),1,null,(select id from removal_ids where label='other_preview')));
select pg_temp.removal_expect($q$select public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),true,0)$q$,'42501');
select pg_temp.removal_expect($q$select public.set_menu_item_removed('request',(select id from removal_ids where label='request_save'),true,0)$q$,'42501');
reset role;
create temporary table removal_snapshot as select id,saved_at,snapshot_revision,snapshot_body,snapshot_links,preview_asset_id
  from public.menu_plate_saves where id=(select id from removal_ids where label='plate_save');

select pg_temp.removal_actor((select id from removal_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.removal_assert(public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),true,0)=1,'first removal');
select pg_temp.removal_assert(public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),true,0)=1,'removal retry is idempotent');
select pg_temp.removal_assert(not exists(select 1 from public.search_menu('Removal searchable recipe') where save_id=(select id from removal_ids where label='plate_save')),'active search excludes removed item');
select pg_temp.removal_assert(exists(select 1 from public.search_menu_items('Removal searchable recipe',true) where save_id=(select id from removal_ids where label='plate_save')),'removed search finds snapshot');
select pg_temp.removal_assert(exists(select 1 from public.saved_menu_item_state('plate',(select id from removal_ids where label='plate')) where removed_at is not null and menu_version=1),'source control sees removed snapshot');
select pg_temp.removal_assert((select count(*)=2 from public.menu_gallery_locations((select id from removal_ids where label='plate_save'))),'removed view retains photo gallery');
select pg_temp.removal_assert(public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),false,1)=2,'Undo restores');
select pg_temp.removal_assert(public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),false,1)=2,'Undo retry idempotent');
select pg_temp.removal_expect($q$select public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),true,0)$q$,'40001');
select pg_temp.removal_assert(public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),true,2)=3,'remove again');
select pg_temp.removal_assert(public.save_plate((select id from removal_ids where label='plate'),1)=(select id from removal_ids where label='plate_save'),'repeat-save keeps original identity');
select pg_temp.removal_assert((select removed_at is not null and menu_version=3 from public.menu_plate_saves where id=(select id from removal_ids where label='plate_save')),'legacy repeat-save does not silently undo removal');
select pg_temp.removal_assert(public.set_menu_item_removed('request',(select id from removal_ids where label='request_save'),true,0)=1,'Request removal');
select pg_temp.removal_assert(not exists(select 1 from public.search_menu('Removal searchable question') where save_id=(select id from removal_ids where label='request_save')),'active Request search excludes removal');
select pg_temp.removal_assert(exists(select 1 from public.search_menu_items('Removal searchable question',true) where save_id=(select id from removal_ids where label='request_save')),'removed Request searchable with current membership');
reset role;
select pg_temp.removal_assert(not exists(select 1 from removal_snapshot old join public.menu_plate_saves s using(id)
  where (old.saved_at,old.snapshot_revision,old.snapshot_body,old.snapshot_links,old.preview_asset_id)
    is distinct from (s.saved_at,s.snapshot_revision,s.snapshot_body,s.snapshot_links,s.preview_asset_id)),'removal preserves snapshot/date/preview');
select pg_temp.removal_assert((select removed_at is null from public.menu_plate_saves where id=(select id from removal_ids where label='other_plate_save')),'other saved Plate untouched');
select pg_temp.removal_assert((select removed_at is null from public.menu_request_saves where id=(select id from removal_ids where label='author_request_save')),'other saved Request untouched');
select pg_temp.removal_assert((select count(*)=3 from public.menu_preview_jobs where plate_id=(select id from removal_ids where label='plate')),'no new previews during removal/restore');

-- Restore organisation independently of revoked original access; live Requests stay private.
select pg_temp.removal_actor((select id from removal_ids where label='author_auth'));
set local role authenticated;
select public.set_my_privacy(true,0);
select public.remove_table_member((select id from removal_ids where label='table'),(select id from removal_ids where label='reader_profile'));
reset role;
select pg_temp.removal_actor((select id from removal_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.removal_assert(public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),false,3)=4,'restore retained snapshot after source privacy revocation');
select pg_temp.removal_assert(not exists(select 1 from public.plate_image_locations((select id from removal_ids where label='plate'))),'restore does not regain original photo access');
select pg_temp.removal_assert(public.set_menu_item_removed('request',(select id from removal_ids where label='request_save'),false,1)=2,'restore Request reference after membership loss');
select pg_temp.removal_assert((select not source_available and question is null and group_name is null from public.menu_request_context where save_id=(select id from removal_ids where label='request_save')),'restored Request hides revoked discussion');
select pg_temp.removal_assert(not exists(select 1 from public.search_menu('Removal searchable question') where save_id=(select id from removal_ids where label='request_save')),'restored private Request not searchable');
select public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),true,4);
reset role;

-- Source erasure overrides removed-copy retention and prevents Undo resurrection.
select pg_temp.removal_actor(null,'service_role');
insert into removal_ids select 'author_erasure',operation_id from public.reserve_account_erasure_record((select id from removal_ids where label='author_auth'));
select public.begin_recorded_account_erasure((select id from removal_ids where label='author_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from removal_ids where label='author_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.removal_actor((select id from removal_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.removal_expect($q$select public.set_menu_item_removed('plate',(select id from removal_ids where label='plate_save'),false,5)$q$,'42501');
select pg_temp.removal_assert(not exists(select 1 from public.menu_gallery_locations((select id from removal_ids where label='plate_save'))),'erasure revokes removed gallery');
select pg_temp.removal_assert(not exists(select 1 from public.search_menu_items('Removal searchable recipe',true)),'erased removed snapshot not searchable');
reset role;
select pg_temp.removal_assert((select count(*)=3 from private.account_erasure_objects e join public.menu_preview_assets a
  on e.object_path=a.object_path and e.bucket_id=a.bucket_id where e.profile_id=(select id from removal_ids where label='author_profile')
    and a.plate_id=(select id from removal_ids where label='plate')),'erasure still tracks every retained derived photo');
select pg_temp.removal_actor(null,'service_role');
insert into removal_ids select 'saver_erasure',operation_id from public.reserve_account_erasure_record((select id from removal_ids where label='reader_auth'));
select public.begin_recorded_account_erasure((select id from removal_ids where label='saver_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from removal_ids where label='saver_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('d',64),'authToken',repeat('e',64),'mac',repeat('f',64)));
select pg_temp.removal_actor((select id from removal_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.removal_expect($q$select public.set_menu_item_removed('request',(select id from removal_ids where label='request_save'),true,2)$q$,'42501');
select pg_temp.removal_assert(not exists(select 1 from public.saved_menu_item_state('request',(select id from removal_ids where label='request'))),'disabled saver has no restore state');
reset role;
set constraints all immediate;
select 'PASS Menu removal: owner-only Plate/Request removal, Undo/retry/conflicts, filtered search, retained gallery/snapshot, independent saves, revoked access and erasure (metadata; rolled back)';
rollback;
