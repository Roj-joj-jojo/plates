begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.social_assert(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',why; end if; end $$;
create function pg_temp.social_expect(sql text,code text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute sql; exception when others then
    get stacked diagnostics actual=returned_sqlstate;
    if actual=code then return; end if;
    raise exception 'Expected %, got %',code,actual;
  end;
  raise exception 'Expected %, operation succeeded',code;
end $$;
create temporary table social_ids(label text primary key,id uuid);
grant select,insert on social_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into social_ids values('author_auth',gen_random_uuid()),('reader_auth',gen_random_uuid()),('outsider_auth',gen_random_uuid()),('open_auth',gen_random_uuid());
-- Admission/account/content fixtures and candidate schema all roll back.
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'social-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Alpha social fixture"}' from social_ids;
insert into social_ids select replace(i.label,'_auth','_profile'),l.profile_id from social_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Alpha'||replace(id::text,'-','')::varchar(20) from social_ids where label like '%_profile';
select pg_temp.social_assert(not has_function_privilege('anon','public.search_people(text,integer)','EXECUTE'),'anonymous search denied');
select pg_temp.social_assert(not has_table_privilege('authenticated','private.follow_edges','SELECT'),'no relationship directory');
select pg_temp.social_assert(not has_table_privilege('authenticated','private.account_privacy','UPDATE'),'no direct privacy writes');
select pg_temp.social_assert(not has_function_privilege('service_role','public.set_follow(uuid,boolean,bigint)','EXECUTE'),'worker cannot follow');
insert into social_ids values('asset',gen_random_uuid());
insert into public.media_upload_intents(id,uploader_id,staged_path,state)
  select id,(select id from social_ids where label='author_profile'),'social-test/'||id,'processing' from social_ids where label='asset';
select set_config('request.jwt.claim.role','service_role',true);
select public.finish_plate_upload(id,id,id::text||'.webp',512,512) from social_ids where label='asset';
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='author_auth'),true);
set local role authenticated;
insert into social_ids values('plate',public.publish_plate((select id from public.categories where slug='recipe'),'Alpha secret recipe'));
insert into social_ids values('photo_plate',public.publish_plate((select id from public.categories where slug='meal'),'Alpha photo', '[]','[]',array[(select id from social_ids where label='asset')]));
insert into social_ids values('table',public.create_table_with_members('Alpha private share fixture',array[(select id from social_ids where label='reader_profile')]));
insert into social_ids values('share',public.share_plate((select id from social_ids where label='table'),(select id from social_ids where label='plate'),gen_random_uuid()));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='open_auth'),true);
set local role authenticated;
insert into social_ids values('open_plate',public.publish_plate((select id from public.categories where slug='meal'),'Alpha open recipe'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='reader_auth'),true);
set local role authenticated;
insert into social_ids values('own_plate',public.publish_plate((select id from public.categories where slug='meal'),'Alpha own recipe'));
select pg_temp.social_assert((select count(*)=1 from public.following_feed() where id in(select id from social_ids where label in('plate','photo_plate','open_plate','own_plate'))),'no-follow Feed includes only own');
select pg_temp.social_assert((select count(*)=1 from public.plates where id=(select id from social_ids where label='open_plate')),'open Plate discoverable without following');
insert into social_ids values('saved',public.save_plate((select id from social_ids where label='plate'),1));
select public.set_follow((select id from social_ids where label='author_profile'),true,0);
select public.set_follow((select id from social_ids where label='author_profile'),true,0);
select pg_temp.social_assert((select follow_state='approved' and follow_version=1 from public.social_person((select id from social_ids where label='author_profile'))),'open follow and retry');
select pg_temp.social_assert((select count(*)=3 from public.following_feed() where id in(select id from social_ids where label in('plate','photo_plate','open_plate','own_plate'))),'followed author plus own, no unrelated author');
select pg_temp.social_expect($q$select public.set_follow((select id from social_ids where label='reader_profile'),true,0)$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='author_auth'),true);
set local role authenticated;
select public.set_my_privacy(true,0);
select public.set_my_privacy(true,0);
select pg_temp.social_assert((select is_private and version=1 from public.my_privacy()),'privacy retry idempotent');
select pg_temp.social_expect($q$select public.set_my_privacy(false,0)$q$,'40001');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='reader_auth'),true);
set local role authenticated;
select pg_temp.social_assert((select count(*)=1 from public.plates where id=(select id from social_ids where label='plate')),'existing follower remains approved');
select pg_temp.social_assert((select count(*)=1 from public.plate_image_locations((select id from social_ids where label='photo_plate'))),'approved photo location');
select pg_temp.social_assert(private.can_read_plate_object('plate-media',(select id::text||'.webp' from social_ids where label='asset')),'approved fresh photo signing');
select public.set_follow((select id from social_ids where label='author_profile'),false,1);
select pg_temp.social_assert((select count(*)=0 from public.plates where id=(select id from social_ids where label='plate')),'Unfollow denies original despite Table membership');
select pg_temp.social_assert((select count(*)=1 from public.private_table_plates((select id from social_ids where label='table'),array[(select id from social_ids where label='plate')])),'member gets private placeholder metadata only');
select pg_temp.social_assert((select snapshot_body='Alpha secret recipe' from public.menu_plate_saves where id=(select id from social_ids where label='saved')),'Menu snapshot retained');
select pg_temp.social_assert((select count(*)=0 from public.plate_image_locations((select id from social_ids where label='photo_plate'))),'unfollow denies image locations');
select pg_temp.social_assert(not private.can_read_plate_object('plate-media',(select id::text||'.webp' from social_ids where label='asset')),'unfollow denies fresh signing');
select pg_temp.social_assert((select count(*)=0 from public.search_plates('Alpha secret recipe')),'search denies original');
select pg_temp.social_expect($q$select public.save_plate((select id from social_ids where label='photo_plate'),1)$q$,'42501');
select pg_temp.social_expect($q$select public.request_menu_preview((select id from social_ids where label='photo_plate'),1)$q$,'42501');
select pg_temp.social_expect($q$select public.share_plate((select id from social_ids where label='table'),(select id from social_ids where label='plate'),gen_random_uuid())$q$,'42501');
select public.set_follow((select id from social_ids where label='author_profile'),true,2);
select pg_temp.social_assert((select follow_state='pending' from public.social_person((select id from social_ids where label='author_profile'))),'private follow becomes pending');
reset role;
insert into social_ids select 'edge',id from private.follow_edges where follower_id=(select id from social_ids where label='reader_profile') and author_id=(select id from social_ids where label='author_profile');
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='outsider_auth'),true);
set local role authenticated;
select pg_temp.social_expect($q$select public.respond_follow((select id from social_ids where label='edge'),true,3)$q$,'42501');
select pg_temp.social_expect($q$select public.private_table_plates((select id from social_ids where label='table'),array[(select id from social_ids where label='plate')])$q$,'42501');
select pg_temp.social_assert((select count(*)=0 from public.my_social_people('requests')),'requests not visible to outsider');
select pg_temp.social_assert((select count(*)=0 from public.plates where id=(select id from social_ids where label='plate')),'outsider cannot directly read private Plate');
select pg_temp.social_assert((select count(*)=0 from public.groups where id=(select id from social_ids where label='table')),'outsider has no Table access');
select pg_temp.social_assert((select count(*)>0 from public.search_people('Alpha')),'active usernames discoverable');
select pg_temp.social_assert((select count(*)=1 from public.social_person((select id from social_ids where label='author_profile'))),'private account identity remains discoverable');
select pg_temp.social_assert((select count(*)=1 from public.picture_locations('profile',array[(select id from social_ids where label='author_profile')])),'profile avatar metadata follows public identity discovery');
select pg_temp.social_assert((select count(*)=0 from public.picture_locations('table',array[(select id from social_ids where label='table')])),'Table avatar stays member-only');
select pg_temp.social_expect($q$select public.search_people('',0)$q$,'23514');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='author_auth'),true);
set local role authenticated;
select pg_temp.social_assert((select count(*)=1 from public.my_social_people('requests') where edge_id=(select id from social_ids where label='edge')),'own request list');
select public.respond_follow((select id from social_ids where label='edge'),false,3);
select public.respond_follow((select id from social_ids where label='edge'),false,3);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='reader_auth'),true);
set local role authenticated;
select public.set_follow((select id from social_ids where label='author_profile'),true,4);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='author_auth'),true);
set local role authenticated;
select public.respond_follow((select id from social_ids where label='edge'),true,5);
select public.respond_follow((select id from social_ids where label='edge'),true,5);
select pg_temp.social_expect($q$select public.respond_follow((select id from social_ids where label='edge'),false,5)$q$,'40001');
select public.respond_follow((select id from social_ids where label='edge'),false,6);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='reader_auth'),true);
set local role authenticated;
select pg_temp.social_assert((select count(*)=0 from public.plates where id=(select id from social_ids where label='plate')),'author removal revokes access');
select public.set_follow((select id from social_ids where label='author_profile'),true,7);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='author_auth'),true);
set local role authenticated;
select public.set_my_privacy(false,1);
select pg_temp.social_assert((select count(*)=0 from public.my_social_people('requests') where edge_id=(select id from social_ids where label='edge')),'opening approves pending');
select public.set_my_bio('Food worth sharing',2);
select pg_temp.social_assert(public.profile_bio((select id from social_ids where label='author_profile'))='Food worth sharing','bio saved');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='reader_auth'),true);
set local role authenticated;
select pg_temp.social_assert((select follow_state='approved' from public.social_person((select id from social_ids where label='author_profile'))),'pending request converted on open');
select pg_temp.social_assert((select count(*)=1 from public.groups where id=(select id from social_ids where label='table')),'Unfollow does not remove existing Table membership');
-- 31 more text-only Plates exercise the 30-row keyset page boundary.
do $$ begin for i in 1..31 loop
  perform public.publish_plate((select id from public.categories where slug='meal'),'Alpha page fixture '||i);
end loop; end $$;
create temporary table first_social_page as select * from public.following_feed();
select pg_temp.social_assert((select count(*)=30 from first_social_page),'first page bound');
create temporary table second_social_page as select * from public.following_feed(
  (select created_at from first_social_page order by created_at,id limit 1),
  (select id from first_social_page order by created_at,id limit 1));
select pg_temp.social_assert(not exists(select 1 from first_social_page a join second_social_page b using(id)),'keyset has no duplicate rows');
select pg_temp.social_assert((select count(*)=4 from second_social_page),'keyset reaches remaining followed and own Plates');
reset role;
select set_config('request.jwt.claim.role','service_role',true);
insert into social_ids select 'erasure_operation',operation_id from public.reserve_account_erasure_record((select id from social_ids where label='author_auth'));
select public.begin_recorded_account_erasure((select id from social_ids where label='erasure_operation'),
  jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent',
    'operationId',(select id from social_ids where label='erasure_operation'),
    'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.social_assert((select state='erased' and follower_id is null and author_id is null from private.follow_edges where id=(select id from social_ids where label='edge')),'cutoff clears both relationship identifiers');
select pg_temp.social_assert((select bio='' from private.account_privacy where profile_id=(select id from social_ids where label='author_profile')),'cutoff clears bio');
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from social_ids where label='author_auth'),true);
set local role authenticated;
select pg_temp.social_expect($q$select public.search_people('Alpha')$q$,'42501');
reset role;
select 'PASS follow privacy: discovery, selected feed, requests, transitions, stale writes, private media, shares, Menu and cutoff';
rollback;
