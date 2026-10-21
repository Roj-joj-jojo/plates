-- Rollback-only metadata fixtures. No Storage/image bytes, worker ownership or Auth deletion.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.updates_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Social/Menu assertion: %',label; end if; end $$;
create function pg_temp.updates_expect(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;
create function pg_temp.updates_actor(actor uuid,kind text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform set_config('request.jwt.claim.role',kind,true);
end $$;
create temporary table updates_ids(label text primary key,id uuid);
grant select,insert on updates_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into updates_ids values('author_auth',gen_random_uuid()),('reader_auth',gen_random_uuid()),('outsider_auth',gen_random_uuid());
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'updates-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Social Menu fixture"}' from updates_ids;
insert into updates_ids select replace(i.label,'_auth','_profile'),l.profile_id
  from updates_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Updates'||left(replace(id::text,'-',''),20) from updates_ids where label like '%_profile';

select pg_temp.updates_assert(not has_table_privilege('authenticated','private.follow_notifications','SELECT'),'no notification directory');
select pg_temp.updates_assert(not has_table_privilege('authenticated','private.menu_saved_photos','INSERT'),'no arbitrary saved attachments');
select pg_temp.updates_assert(not has_function_privilege('anon','public.my_follow_notifications()','EXECUTE'),'anonymous notifications refused');
select pg_temp.updates_assert(not has_function_privilege('anon','public.menu_gallery_locations(uuid)','EXECUTE'),'anonymous gallery refused');
select pg_temp.updates_assert(not has_function_privilege('service_role','public.request_menu_gallery(uuid,bigint)','EXECUTE'),'worker cannot request galleries');

-- Real authenticated role for recipient isolation and relationship state transitions.
select pg_temp.updates_actor((select id from updates_ids where label='reader_auth'));
set local role authenticated;
select public.set_follow((select id from updates_ids where label='author_profile'),true,0);
select public.set_follow((select id from updates_ids where label='author_profile'),true,0);
reset role;
insert into updates_ids select 'edge',id from private.follow_edges
  where follower_id=(select id from updates_ids where label='reader_profile') and author_id=(select id from updates_ids where label='author_profile');
insert into updates_ids select 'notification',id from private.follow_notifications where edge_id=(select id from updates_ids where label='edge');
select pg_temp.updates_assert((select count(*)=1 from private.follow_notifications where edge_id=(select id from updates_ids where label='edge')),'follow retry creates one event');
select pg_temp.updates_actor((select id from updates_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.updates_assert(not exists(select 1 from public.my_follow_notifications() where id=(select id from updates_ids where label='notification')),'outsider cannot read event');
select public.read_follow_notification((select id from updates_ids where label='notification'));
reset role;
select pg_temp.updates_assert((select read_at is null from private.follow_notifications where id=(select id from updates_ids where label='notification')),'outsider cannot mark event read');
select pg_temp.updates_actor((select id from updates_ids where label='author_auth'));
set local role authenticated;
select pg_temp.updates_assert(exists(select 1 from public.my_follow_notifications() where id=(select id from updates_ids where label='notification') and kind='new_follower'),'recipient sees new follower');
select public.read_follow_notification((select id from updates_ids where label='notification'));
select pg_temp.updates_assert(exists(select 1 from public.my_follow_notifications() where id=(select id from updates_ids where label='notification') and read_at is not null),'recipient marks read');
select public.set_my_privacy(true,0);
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='reader_auth'));
set local role authenticated;
select public.set_follow((select id from updates_ids where label='author_profile'),false,1);
select public.set_follow((select id from updates_ids where label='author_profile'),true,2);
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='author_auth'));
set local role authenticated;
select pg_temp.updates_assert(exists(select 1 from public.my_follow_notifications() where edge_id=(select id from updates_ids where label='edge') and kind='follow_request' and edge_version=3),'private request is actionable');
select public.respond_follow((select id from updates_ids where label='edge'),false,3);
select pg_temp.updates_assert(not exists(select 1 from public.my_follow_notifications() where edge_id=(select id from updates_ids where label='edge')),'decline resolves request');
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='reader_auth'));
set local role authenticated;
select public.set_follow((select id from updates_ids where label='author_profile'),true,4);
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='author_auth'));
set local role authenticated;
select pg_temp.updates_expect($q$select public.respond_follow((select id from updates_ids where label='edge'),true,3)$q$,'40001');
select public.respond_follow((select id from updates_ids where label='edge'),true,5);
select pg_temp.updates_assert(not exists(select 1 from public.my_follow_notifications() where edge_id=(select id from updates_ids where label='edge')),'accept resolves request without self-generated follower alert');
reset role;

-- Six source images and derived previews are synthetic metadata only, never Storage objects.
select pg_temp.updates_actor(null,'service_role');
do $$ declare intent uuid; asset uuid; author uuid:=(select id from updates_ids where label='author_profile');
begin
  for i in 1..6 loop
    intent:=gen_random_uuid(); asset:=gen_random_uuid();
    insert into public.media_upload_intents(id,uploader_id,staged_path,state) values(intent,author,author::text||'/'||intent::text,'processing');
    perform public.finish_plate_upload(intent,asset,asset::text||'.webp',640,480);
    insert into updates_ids values('asset_'||i,asset);
  end loop;
end $$;
select pg_temp.updates_actor((select id from updates_ids where label='author_auth'));
set local role authenticated;
insert into updates_ids values('plate',public.publish_plate((select id from public.categories where slug='meal'),'Gallery fixture',
  '[]','[]',array(select id from updates_ids where label like 'asset_%' order by label)));
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.updates_expect($q$select * from public.request_menu_gallery((select id from updates_ids where label='plate'),1)$q$,'42501');
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.updates_expect($q$select * from public.request_menu_gallery((select id from updates_ids where label='plate'),999)$q$,'40001');
insert into updates_ids select 'gallery_'||image_position,job_id from public.request_menu_gallery((select id from updates_ids where label='plate'),1);
select pg_temp.updates_assert((select count(*)=6 from public.request_menu_gallery((select id from updates_ids where label='plate'),1)),'six-job gallery retry');
select pg_temp.updates_assert(not exists(select 1 from public.request_menu_gallery((select id from updates_ids where label='plate'),1) g
  where g.job_id<>(select id from updates_ids where label='gallery_'||g.image_position)),'retry returns same jobs and order');
reset role;
do $$ declare job public.menu_preview_jobs%rowtype; asset uuid;
begin
  for job in select j.* from public.menu_preview_jobs j join updates_ids i on i.id=j.id where i.label like 'gallery_%' and i.label<>'gallery_5' loop
    asset:=gen_random_uuid();
    insert into public.menu_preview_assets(id,job_id,saver_id,plate_id,source_asset_id,source_revision,bucket_id,object_path,width,height)
      values(asset,job.id,job.saver_id,job.plate_id,job.source_asset_id,job.source_revision,'menu-previews',job.saver_id::text||'/'||asset::text||'.webp',640,480);
    update public.menu_preview_jobs set state='ready',preview_asset_id=asset where id=job.id;
  end loop;
end $$;
insert into updates_ids select 'first_preview',preview_asset_id from public.menu_preview_jobs where id=(select id from updates_ids where label='gallery_0');
set local role authenticated;
select pg_temp.updates_expect($q$select public.save_plate((select id from updates_ids where label='plate'),1,null,(select id from updates_ids where label='first_preview'))$q$,'23514');
reset role;
do $$ declare job public.menu_preview_jobs%rowtype; asset uuid:=gen_random_uuid();
begin
  select * into job from public.menu_preview_jobs where id=(select id from updates_ids where label='gallery_5');
  insert into public.menu_preview_assets(id,job_id,saver_id,plate_id,source_asset_id,source_revision,bucket_id,object_path,width,height)
    values(asset,job.id,job.saver_id,job.plate_id,job.source_asset_id,job.source_revision,'menu-previews',job.saver_id::text||'/'||asset::text||'.webp',640,480);
  update public.menu_preview_jobs set state='ready',preview_asset_id=asset where id=job.id;
end $$;
set local role authenticated;
insert into updates_ids values('save',public.save_plate((select id from updates_ids where label='plate'),1,null,(select id from updates_ids where label='first_preview')));
select pg_temp.updates_assert(public.save_plate((select id from updates_ids where label='plate'),1)=(select id from updates_ids where label='save'),'save retry preserves identity');
select pg_temp.updates_assert((select count(*)=6 from public.menu_gallery_locations((select id from updates_ids where label='save'))),'all saved images readable');
select pg_temp.updates_assert((select array_agg(image_position order by image_position)=array[0,1,2,3,4,5] from public.menu_gallery_locations((select id from updates_ids where label='save'))),'saved image order');
select pg_temp.updates_assert((select bool_and(private.can_read_menu_preview_object('menu-previews',object_path)) from public.menu_gallery_locations((select id from updates_ids where label='save'))),'all saved image paths signable');
select public.set_follow((select id from updates_ids where label='author_profile'),false,6);
select pg_temp.updates_assert((select count(*)=6 from public.menu_gallery_locations((select id from updates_ids where label='save'))),'gallery survives follower revocation');
select pg_temp.updates_assert(not exists(select 1 from public.plate_image_locations((select id from updates_ids where label='plate'))),'original photos denied after revocation');
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.updates_assert(not exists(select 1 from public.menu_gallery_locations((select id from updates_ids where label='save'))),'outsider cannot read saved gallery');
reset role;

-- Saver cutoff must track every derived object; source cutoff must erase event identities.
select pg_temp.updates_actor(null,'service_role');
insert into updates_ids select 'erasure',operation_id from public.reserve_account_erasure_record((select id from updates_ids where label='reader_auth'));
select public.begin_recorded_account_erasure((select id from updates_ids where label='erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from updates_ids where label='erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.updates_assert((select count(*)=6 from private.account_erasure_objects e join public.menu_preview_assets a
  on e.object_path=a.object_path and e.bucket_id=a.bucket_id where e.profile_id=(select id from updates_ids where label='reader_profile')
    and a.saver_id=e.profile_id),'saver erasure tracks all derived objects');
select pg_temp.updates_assert(not exists(select 1 from private.follow_notifications where sender_id=(select id from updates_ids where label='reader_profile')),'erasure clears notification sender');
select pg_temp.updates_actor((select id from updates_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.updates_assert(not exists(select 1 from public.menu_gallery_locations((select id from updates_ids where label='save'))),'erased saver cannot read gallery');
reset role;

-- Backward compatibility: an older one-preview save remains a one-photo snapshot.
select pg_temp.updates_actor((select id from updates_ids where label='author_auth'));
set local role authenticated;
select public.set_my_privacy(false,1);
reset role;
select pg_temp.updates_actor((select id from updates_ids where label='outsider_auth'));
set local role authenticated;
select public.set_follow((select id from updates_ids where label='author_profile'),true,0);
insert into updates_ids values('legacy_job',public.request_menu_preview((select id from updates_ids where label='plate'),1));
reset role;
do $$ declare job public.menu_preview_jobs%rowtype; asset uuid:=gen_random_uuid();
begin
  select * into job from public.menu_preview_jobs where id=(select id from updates_ids where label='legacy_job');
  insert into public.menu_preview_assets(id,job_id,saver_id,plate_id,source_asset_id,source_revision,bucket_id,object_path,width,height)
    values(asset,job.id,job.saver_id,job.plate_id,job.source_asset_id,job.source_revision,'menu-previews',job.saver_id::text||'/'||asset::text||'.webp',640,480);
  update public.menu_preview_jobs set state='ready',preview_asset_id=asset where id=job.id;
  insert into updates_ids values('legacy_preview',asset);
end $$;
set local role authenticated;
insert into updates_ids values('legacy_save',public.save_plate((select id from updates_ids where label='plate'),1,null,(select id from updates_ids where label='legacy_preview')));
select pg_temp.updates_assert((select count(*)=1 from public.menu_gallery_locations((select id from updates_ids where label='legacy_save'))),'legacy single-photo save still readable');
reset role;
select pg_temp.updates_actor(null,'service_role');
insert into updates_ids select 'author_erasure',operation_id from public.reserve_account_erasure_record((select id from updates_ids where label='author_auth'));
select public.begin_recorded_account_erasure((select id from updates_ids where label='author_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from updates_ids where label='author_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('d',64),'authToken',repeat('e',64),'mac',repeat('f',64)));
select pg_temp.updates_assert((select count(*)=7 from private.account_erasure_objects e join public.menu_preview_assets a
  on e.object_path=a.object_path and e.bucket_id=a.bucket_id where e.profile_id=(select id from updates_ids where label='author_profile')
    and a.plate_id=(select id from updates_ids where label='plate')),'source erasure tracks all derived objects across savers');
select pg_temp.updates_assert(not exists(select 1 from private.follow_notifications where recipient_id=(select id from updates_ids where label='author_profile')),'erasure clears notification recipient');
select pg_temp.updates_actor((select id from updates_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.updates_assert(not exists(select 1 from public.menu_gallery_locations((select id from updates_ids where label='legacy_save'))),'source erasure denies saved photos');
reset role;
set constraints all immediate;
select 'PASS social Menu updates: notification isolation/retries/actions, six-photo gallery/revocation/legacy saves and saver/source cutoff (metadata; rolled back)';
rollback;
