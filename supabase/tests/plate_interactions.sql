-- Rollback-only business/role fixtures. No Storage, photo worker, Auth deletion or object cleanup.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.interaction_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Plate interaction assertion: %',label; end if; end $$;
create function pg_temp.interaction_expect(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;
create function pg_temp.interaction_actor(actor uuid,kind text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform set_config('request.jwt.claim.role',kind,true);
end $$;
create temporary table interaction_ids(label text primary key,id uuid);
grant select,insert on interaction_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into interaction_ids values('author_auth',gen_random_uuid()),('reader_auth',gen_random_uuid()),('outsider_auth',gen_random_uuid()),('request_a',gen_random_uuid());
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'interaction-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Plate interaction fixture"}'
    from interaction_ids where label like '%_auth';
insert into interaction_ids select replace(i.label,'_auth','_profile'),l.profile_id from interaction_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Interact'||left(replace(id::text,'-',''),20) from interaction_ids where label like '%_profile';
select pg_temp.interaction_assert(not has_function_privilege('anon','public.plate_comments_page(uuid,timestamptz,uuid)','EXECUTE'),'anonymous comment reads denied');
select pg_temp.interaction_assert(not has_function_privilege('anon','public.plate_interaction_summary(uuid[])','EXECUTE'),'anonymous counts denied');
select pg_temp.interaction_assert(not has_function_privilege('service_role','public.create_plate_comment(uuid,uuid,text)','EXECUTE'),'worker cannot comment');
select pg_temp.interaction_assert(not has_function_privilege('service_role','public.set_plate_like(uuid,boolean,bigint)','EXECUTE'),'worker cannot like');
select pg_temp.interaction_assert(not has_table_privilege('authenticated','private.plate_comments','SELECT'),'no direct comment directory');
select pg_temp.interaction_assert(not has_table_privilege('authenticated','private.plate_likes','SELECT'),'no liker directory');

select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
insert into interaction_ids values('plate',public.publish_plate((select id from public.categories where slug='meal'),'Interaction fixture recipe'));
insert into interaction_ids values('secondary',public.publish_plate((select id from public.categories where slug='meal'),'Interaction unpublish fixture'));
insert into interaction_ids values('table',public.create_table_with_members('Interaction private Table',array[(select id from interaction_ids where label='reader_profile')]));
insert into interaction_ids values('share',public.share_plate((select id from interaction_ids where label='table'),(select id from interaction_ids where label='plate'),gen_random_uuid()));
select pg_temp.interaction_assert(public.set_plate_like((select id from interaction_ids where label='plate'),true,0)=1,'self-like allowed');
select pg_temp.interaction_assert(not exists(select 1 from public.my_plate_comment_notifications()),'likes never create comment notifications');
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='reader_auth'));
set local role authenticated;
insert into interaction_ids values('menu_save',public.save_plate((select id from interaction_ids where label='plate'),1));
select pg_temp.interaction_assert(public.set_plate_like((select id from interaction_ids where label='plate'),true,0)=1,'open reader need not follow');
select pg_temp.interaction_assert(public.set_plate_like((select id from interaction_ids where label='plate'),true,0)=1,'like retry idempotent');
select pg_temp.interaction_assert((select like_count=2 and liked and like_version=1 from public.plate_interaction_summary(array[(select id from interaction_ids where label='plate')])),'count and viewer state');
select pg_temp.interaction_assert(public.set_plate_like((select id from interaction_ids where label='plate'),false,1)=2,'unlike');
select pg_temp.interaction_expect($q$select public.set_plate_like((select id from interaction_ids where label='plate'),true,0)$q$,'40001');
select public.set_plate_like((select id from interaction_ids where label='plate'),true,2);
select pg_temp.interaction_expect($q$select public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'   ')$q$,'23514');
select pg_temp.interaction_expect($q$select public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),repeat('x',2001))$q$,'23514');
insert into interaction_ids values('comment_a',public.create_plate_comment((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='request_a'),'Original comment'));
select pg_temp.interaction_assert(public.create_plate_comment((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='request_a'),'Original comment')=(select id from interaction_ids where label='comment_a'),'create retry returns same comment');
select pg_temp.interaction_expect($q$select public.create_plate_comment((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='request_a'),'Changed request')$q$,'23514');
select pg_temp.interaction_assert(public.edit_plate_comment((select id from interaction_ids where label='comment_a'),1,'Edited comment')=2,'own edit');
select pg_temp.interaction_assert(public.edit_plate_comment((select id from interaction_ids where label='comment_a'),1,'Edited comment')=2,'edit retry');
select pg_temp.interaction_expect($q$select public.edit_plate_comment((select id from interaction_ids where label='comment_a'),1,'Stale edit')$q$,'40001');
select pg_temp.interaction_assert(public.create_plate_comment((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='request_a'),'Original comment')=(select id from interaction_ids where label='comment_a'),'create retry after edit does not overwrite it');
reset role;
insert into interaction_ids select 'notification_a',id from private.plate_comment_notifications where comment_id=(select id from interaction_ids where label='comment_a');
select pg_temp.interaction_assert((select count(*)=1 from private.plate_comment_notifications where comment_id=(select id from interaction_ids where label='comment_a')),'no edit/retry duplicate notifications');
select pg_temp.interaction_actor((select id from interaction_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.interaction_assert(not exists(select 1 from public.my_plate_comment_notifications() where id=(select id from interaction_ids where label='notification_a')),'notification recipient isolation');
select public.read_plate_comment_notification((select id from interaction_ids where label='notification_a'));
select pg_temp.interaction_expect($q$select public.remove_plate_comment((select id from interaction_ids where label='comment_a'),2)$q$,'42501');
reset role;
select pg_temp.interaction_assert((select read_at is null from private.plate_comment_notifications where id=(select id from interaction_ids where label='notification_a')),'outsider cannot mark notification read');
select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
select pg_temp.interaction_assert(exists(select 1 from public.my_plate_comment_notifications() where id=(select id from interaction_ids where label='notification_a')),'Plate author notified');
select public.read_plate_comment_notification((select id from interaction_ids where label='notification_a'));
select pg_temp.interaction_expect($q$select public.edit_plate_comment((select id from interaction_ids where label='comment_a'),2,'Moderator rewrite')$q$,'42501');
select pg_temp.interaction_expect($q$select public.remove_plate_comment((select id from interaction_ids where label='comment_a'),1)$q$,'40001');
select pg_temp.interaction_assert(public.remove_plate_comment((select id from interaction_ids where label='comment_a'),2)=3,'Plate author moderates');
select pg_temp.interaction_assert(public.remove_plate_comment((select id from interaction_ids where label='comment_a'),2)=3,'moderation retry');
select pg_temp.interaction_assert(not exists(select 1 from public.my_plate_comment_notifications() where id=(select id from interaction_ids where label='notification_a')),'removed text notification hidden');
insert into interaction_ids values('own_comment',public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'Author comment'));
reset role;
select pg_temp.interaction_assert(not exists(select 1 from private.plate_comment_notifications where comment_id=(select id from interaction_ids where label='own_comment')),'own comment no notification');
select pg_temp.interaction_actor((select id from interaction_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.interaction_assert(public.create_plate_comment((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='request_a'),'Original comment')=(select id from interaction_ids where label='comment_a'),'retry cannot resurrect removed comment');
select pg_temp.interaction_assert((select body='' and author_id is null and not can_edit and not can_remove from public.plate_comment_by_id((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='comment_a'))),'placeholder hides text/identity/controls');
select pg_temp.interaction_expect($q$select public.edit_plate_comment((select id from interaction_ids where label='comment_a'),3,'Resurrection')$q$,'23514');
insert into interaction_ids values('own_removed',public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'Own removal'));
select public.remove_plate_comment((select id from interaction_ids where label='own_removed'),1);
insert into interaction_ids values('secondary_comment',public.create_plate_comment((select id from interaction_ids where label='secondary'),gen_random_uuid(),'Unpublish notification'));
do $$ begin for i in 1..32 loop
  insert into interaction_ids values('page_'||i,public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'Page fixture '||i));
end loop; end $$;
create temporary table interaction_page_one as select * from public.plate_comments_page((select id from interaction_ids where label='plate'));
create temporary table interaction_page_two as select * from public.plate_comments_page((select id from interaction_ids where label='plate'),
  (select created_at from interaction_page_one order by created_at,id limit 1),(select id from interaction_page_one order by created_at,id limit 1));
select pg_temp.interaction_assert((select count(*)=30 from interaction_page_one),'bounded newest page');
select pg_temp.interaction_assert((select count(*)=5 from interaction_page_two),'older page retains placeholders');
select pg_temp.interaction_assert(not exists(select 1 from interaction_page_one a join interaction_page_two b using(id)),'stable keyset no duplicates');
select pg_temp.interaction_assert((select body='Page fixture 1' from public.plate_comment_by_id((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='page_1'))),'deep link can resolve an older comment');
select pg_temp.interaction_assert((select comment_count=33 from public.plate_interaction_summary(array[(select id from interaction_ids where label='plate')])),'count excludes removed comments');
select pg_temp.interaction_assert((select snapshot_body='Interaction fixture recipe' from public.menu_plate_saves where id=(select id from interaction_ids where label='menu_save')),'Menu snapshot independent');
select pg_temp.interaction_assert(not exists(select 1 from public.thread_replies where group_id=(select id from interaction_ids where label='table')),'direct comments not Table replies');
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
select public.unpublish_plate((select id from interaction_ids where label='secondary'),1);
select pg_temp.interaction_assert(not exists(select 1 from public.my_plate_comment_notifications() where plate_id=(select id from interaction_ids where label='secondary')),'unpublished notification hidden');
select public.set_my_privacy(true,0);
reset role;

-- Existing Menu save and Table membership must not confer private original interaction access.
select pg_temp.interaction_actor((select id from interaction_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.interaction_assert(not exists(select 1 from public.plate_interaction_summary(array[(select id from interaction_ids where label='plate')])),'private counts denied');
select pg_temp.interaction_assert(not exists(select 1 from public.plate_comments_page((select id from interaction_ids where label='plate'))),'private comments denied');
select pg_temp.interaction_assert(not exists(select 1 from public.plate_comment_by_id((select id from interaction_ids where label='plate'),(select id from interaction_ids where label='page_1'))),'private deep comment denied');
select pg_temp.interaction_expect($q$select public.set_plate_like((select id from interaction_ids where label='plate'),false,3)$q$,'42501');
select pg_temp.interaction_expect($q$select public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'Private outsider')$q$,'42501');
select pg_temp.interaction_expect($q$select public.edit_plate_comment((select id from interaction_ids where label='page_1'),1,'Private edit')$q$,'42501');
select pg_temp.interaction_expect($q$select public.remove_plate_comment((select id from interaction_ids where label='page_1'),1)$q$,'42501');
select pg_temp.interaction_assert((select snapshot_body='Interaction fixture recipe' from public.menu_plate_saves where id=(select id from interaction_ids where label='menu_save')),'saved copy retained without interaction access');
select public.set_follow((select id from interaction_ids where label='author_profile'),true,0);
reset role;
insert into interaction_ids select 'edge',id from private.follow_edges where follower_id=(select id from interaction_ids where label='reader_profile') and author_id=(select id from interaction_ids where label='author_profile');
select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
select public.respond_follow((select id from interaction_ids where label='edge'),true,1);
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.interaction_assert((select count(*)=30 from public.plate_comments_page((select id from interaction_ids where label='plate'))),'approved follower reads');
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
select public.respond_follow((select id from interaction_ids where label='edge'),false,2);
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.interaction_assert(not exists(select 1 from public.plate_comments_page((select id from interaction_ids where label='plate'))),'follower revocation denies fresh read');
select pg_temp.interaction_expect($q$select public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'Revoked')$q$,'42501');
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
select public.set_my_privacy(false,1);
reset role;

-- Synthetic receipt only: exercises database cutoff, not signing/real cleanup.
select pg_temp.interaction_actor(null,'service_role');
insert into interaction_ids select 'reader_erasure',operation_id from public.reserve_account_erasure_record((select id from interaction_ids where label='reader_auth'));
select public.begin_recorded_account_erasure((select id from interaction_ids where label='reader_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from interaction_ids where label='reader_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.interaction_assert(not exists(select 1 from private.plate_comments where author_id=(select id from interaction_ids where label='reader_profile')),'commenter identity erased');
select pg_temp.interaction_assert((select state='erased' and body='' and request_hash is null and client_request_id is null from private.plate_comments where id=(select id from interaction_ids where label='page_1')),'commenter text and request fingerprint erased');
select pg_temp.interaction_assert(not exists(select 1 from private.plate_likes where profile_id=(select id from interaction_ids where label='reader_profile')),'erased liker identity cleared');
select pg_temp.interaction_assert(not exists(select 1 from private.plate_comment_notifications where sender_id=(select id from interaction_ids where label='reader_profile')),'erased notification sender cleared');
select pg_temp.interaction_actor((select id from interaction_ids where label='author_auth'));
set local role authenticated;
select pg_temp.interaction_assert((select like_count=1 and comment_count=1 from public.plate_interaction_summary(array[(select id from interaction_ids where label='plate')])),'erasure removes likes/comment counts but preserves other author');
reset role;
select pg_temp.interaction_actor((select id from interaction_ids where label='outsider_auth'));
set local role authenticated;
insert into interaction_ids values('last_comment',public.create_plate_comment((select id from interaction_ids where label='plate'),gen_random_uuid(),'Other commenter before source erasure'));
reset role;
select pg_temp.interaction_actor(null,'service_role');
insert into interaction_ids select 'author_erasure',operation_id from public.reserve_account_erasure_record((select id from interaction_ids where label='author_auth'));
select public.begin_recorded_account_erasure((select id from interaction_ids where label='author_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from interaction_ids where label='author_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('d',64),'authToken',repeat('e',64),'mac',repeat('f',64)));
select pg_temp.interaction_assert((select state='erased' and body='' and author_id is null from private.plate_comments where id=(select id from interaction_ids where label='last_comment')),'source erasure clears remaining discussion');
select pg_temp.interaction_assert(not exists(select 1 from private.plate_likes where plate_id=(select id from interaction_ids where label='plate') and (active or profile_id is not null)),'source erasure clears likes');
select pg_temp.interaction_assert(not exists(select 1 from private.plate_comment_notifications where recipient_id=(select id from interaction_ids where label='author_profile')),'recipient identity erased');
select pg_temp.interaction_actor((select id from interaction_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.interaction_assert(not exists(select 1 from public.plate_interaction_summary(array[(select id from interaction_ids where label='plate')])),'erased source counts denied');
select pg_temp.interaction_assert(not exists(select 1 from public.plate_comments_page((select id from interaction_ids where label='plate'))),'erased source comments denied');
reset role;
set constraints all immediate;
select 'PASS Plate interactions: likes/retries, own edit/removal/moderation, notifications, keyset/deep links, private/revoked/unpublished access, Table/Menu separation and commenter/source cutoff (rolled back)';
rollback;
