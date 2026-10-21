-- Rollback only. Synthetic text/metadata; no Storage, worker or Auth removal.
begin;
create function pg_temp.activity_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Activity assertion: %',label; end if; end $$;
create function pg_temp.activity_expect(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;
create function pg_temp.activity_actor(actor uuid,kind text default 'authenticated') returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true); perform set_config('request.jwt.claim.role',kind,true); end $$;
create temporary table activity_ids(label text primary key,id uuid,stamp timestamptz);
grant select,insert,update on activity_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into activity_ids(label,id) values('author_auth',gen_random_uuid()),('reader_auth',gen_random_uuid()),('outsider_auth',gen_random_uuid()),('message_request',gen_random_uuid());
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'activity-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Activity fixture"}' from activity_ids where label like '%_auth';
insert into activity_ids(label,id) select replace(i.label,'_auth','_profile'),l.profile_id from activity_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Activity'||left(replace(id::text,'-',''),20) from activity_ids where label like '%_profile';
select pg_temp.activity_assert(not has_table_privilege('authenticated','private.table_activity_events','SELECT'),'no event directory');
select pg_temp.activity_assert(not has_table_privilege('authenticated','private.table_activity_events','UPDATE'),'no direct read writes');
select pg_temp.activity_assert(not has_function_privilege('anon','public.my_table_activity()','EXECUTE'),'anonymous list denied');
select pg_temp.activity_assert(not has_function_privilege('service_role','public.ack_table_activity(uuid,uuid,uuid[])','EXECUTE'),'worker cannot acknowledge');

select pg_temp.activity_actor((select id from activity_ids where label='author_auth'));
set local role authenticated;
insert into activity_ids(label,id) values('table',public.create_table_with_members('Activity main Table',array[(select id from activity_ids where label='reader_profile')]));
insert into activity_ids(label,id) values('other_table',public.create_table_with_members('Activity other Table',array[(select id from activity_ids where label='reader_profile')]));
select public.add_table_members((select id from activity_ids where label='table'),array[(select id from activity_ids where label='reader_profile')]);
select public.set_table_admin((select id from activity_ids where label='table'),(select id from activity_ids where label='reader_profile'),true);
select public.set_table_admin((select id from activity_ids where label='table'),(select id from activity_ids where label='reader_profile'),false);
select pg_temp.activity_assert(not exists(select 1 from public.my_table_activity()),'no self Table additions');
select public.set_my_privacy(true,0);
insert into activity_ids(label,id) values('plate',public.publish_plate((select id from public.categories where slug='meal'),'Private original activity fixture'));
insert into activity_ids(label,id) values('share',public.share_plate((select id from activity_ids where label='table'),(select id from activity_ids where label='plate'),gen_random_uuid()));
insert into activity_ids(label,id) values('question',public.post_table_request((select id from activity_ids where label='table'),gen_random_uuid(),'Activity fixture question'));
insert into activity_ids(label,id) select 'thread',id from public.threads where root_entry_id=(select id from activity_ids where label='question');
insert into activity_ids(label,id) values('message',public.post_message((select id from activity_ids where label='table'),(select id from activity_ids where label='message_request'),
  'Hello @'||(select username from public.resolve_mentions(array[(select id from activity_ids where label='reader_profile')]))));
select pg_temp.activity_assert(public.post_message((select id from activity_ids where label='table'),(select id from activity_ids where label='message_request'),
  'Hello @'||(select username from public.resolve_mentions(array[(select id from activity_ids where label='reader_profile')])) )=(select id from activity_ids where label='message'),'posting retry reuses event source');
insert into activity_ids(label,id) values('edited_message',public.post_message((select id from activity_ids where label='table'),gen_random_uuid(),'Plain message'));
insert into activity_ids(label,id,stamp) select 'old_message_snapshot',id,updated_at from public.timeline_content where id=(select id from activity_ids where label='edited_message');
select public.edit_table_content((select id from activity_ids where label='edited_message'),(select stamp from activity_ids where label='old_message_snapshot'),
  'Now mentions @'||(select username from public.resolve_mentions(array[(select id from activity_ids where label='reader_profile')])));
reset role;
select pg_temp.activity_assert((select count(*)=1 from private.table_activity_events where entry_id=(select id from activity_ids where label='message') and recipient_id=(select id from activity_ids where label='reader_profile')),'message and mention are one event');
select pg_temp.activity_assert((select count(*)=2 from private.table_activity_events where entry_id=(select id from activity_ids where label='edited_message') and recipient_id=(select id from activity_ids where label='reader_profile')),'new edited mention has its own receipt');

select pg_temp.activity_actor((select id from activity_ids where label='reader_auth'));
set local role authenticated;
insert into activity_ids(label,id) values('period',public.table_activity_period((select id from activity_ids where label='table')));
select pg_temp.activity_assert((select count(*)=2 from public.my_table_activity()),'one unread group per Table');
select pg_temp.activity_assert((select count(*)=2 from public.my_table_activity()),'opening list does not acknowledge');
select pg_temp.activity_assert((select unread_count=6 and mention_count=2 from public.my_table_activity() where group_id=(select id from activity_ids where label='table')),'grouped count and distinct mentioned sources');
select pg_temp.activity_assert(not exists(select 1 from public.plates where id=(select id from activity_ids where label='plate')),'private original still hidden despite Table activity');
insert into activity_ids(label,id) select 'old_receipt',id from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),
  jsonb_build_array(jsonb_build_object('id',(select id from activity_ids where label='edited_message'),'updated_at',(select stamp from activity_ids where label='old_message_snapshot'))));
select public.ack_table_activity((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),array[(select id from activity_ids where label='old_receipt')]);
select pg_temp.activity_assert((select count(*)=1 from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),
  (select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at)) from public.timeline_content where id=(select id from activity_ids where label='edited_message')))),'old receipt does not clear newer mention');
select pg_temp.activity_assert(not exists(select 1 from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'))),'no unloaded sources returned');
select pg_temp.activity_expect($q$select public.ack_table_activity((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),array_fill(gen_random_uuid(),array[101]))$q$,'23514');
select public.set_follow((select id from activity_ids where label='author_profile'),true,0);
reset role;
insert into activity_ids(label,id) select 'edge',id from private.follow_edges where author_id=(select id from activity_ids where label='author_profile') and follower_id=(select id from activity_ids where label='reader_profile');

select pg_temp.activity_actor((select id from activity_ids where label='author_auth'));
set local role authenticated;
select public.respond_follow((select id from activity_ids where label='edge'),true,1);
select public.respond_follow((select id from activity_ids where label='edge'),true,1);
do $$ declare n integer; result uuid; begin
  for n in 1..103 loop
    result:=public.reply_to_thread((select id from activity_ids where label='thread'),gen_random_uuid(),'Activity reply '||n);
    if n=103 then insert into activity_ids(label,id) values('late_reply',result); end if;
  end loop;
end $$;
select pg_temp.activity_assert(not exists(select 1 from public.my_table_activity()),'own posts do not notify actor');
reset role;
select pg_temp.activity_assert((select count(*)=1 from private.follow_acceptance_notifications where edge_id=(select id from activity_ids where label='edge')),'follow approval retry deduplicated');

select pg_temp.activity_actor((select id from activity_ids where label='reader_auth'));
set local role authenticated;
insert into activity_ids(label,id) select 'accept_notice',id from public.my_follow_notifications() where kind='follow_accepted';
select pg_temp.activity_assert((select count(*)=1 from public.my_follow_notifications() where kind='follow_accepted'),'approval notification reaches follower');
select public.read_follow_notification((select id from activity_ids where label='accept_notice'));
select pg_temp.activity_assert((select read_at is not null from public.my_follow_notifications() where kind='follow_accepted'),'approval can be marked read');
select pg_temp.activity_assert((select destination like '%?reply=%#reply-%' from public.my_table_activity() where group_id=(select id from activity_ids where label='table')),'reply destination focuses source outside first window');
select pg_temp.activity_assert(not exists(select 1 from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),'[]',
  (select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at)) from (select * from public.reply_content where thread_id=(select id from activity_ids where label='thread') order by position limit 100) displayed)) where reply_id=(select id from activity_ids where label='late_reply')),'unloaded late reply not acknowledged');
select pg_temp.activity_assert((select count(*)=1 from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),'[]',
  (select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at)) from public.reply_content where id=(select id from activity_ids where label='late_reply')))),'focused late reply can obtain its own receipt');
insert into activity_ids(label,id) values('self_message',public.post_message((select id from activity_ids where label='table'),gen_random_uuid(),'Reader own message'));
reset role;
select pg_temp.activity_assert(not exists(select 1 from private.table_activity_events where entry_id=(select id from activity_ids where label='self_message') and recipient_id=(select id from activity_ids where label='reader_profile')),'no self-message receipt');

select pg_temp.activity_actor((select id from activity_ids where label='outsider_auth'));
set local role authenticated;
select pg_temp.activity_assert(not exists(select 1 from public.my_table_activity()),'outsider list isolated');
select pg_temp.activity_expect($q$select * from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'))$q$,'42501');
select pg_temp.activity_expect($q$select public.ack_table_activity((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),array[(select id from activity_ids where label='old_receipt')])$q$,'42501');
reset role;

select pg_temp.activity_actor((select id from activity_ids where label='author_auth'));
set local role authenticated;
insert into activity_ids(label,id) values('late_message',public.post_message((select id from activity_ids where label='table'),gen_random_uuid(),'New update after old page'));
select public.remove_table_content((select id from activity_ids where label='message'),(select updated_at from public.timeline_content where id=(select id from activity_ids where label='message')));
reset role;
select pg_temp.activity_actor((select id from activity_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.activity_assert(not exists(select 1 from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),
  jsonb_build_array(jsonb_build_object('id',(select id from activity_ids where label='message'),'updated_at',clock_timestamp())))),'removed source hides its unread receipt before membership changes');
select public.ack_table_activity((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),array[(select id from activity_ids where label='old_receipt')]);
select pg_temp.activity_assert((select count(*)=1 from public.table_activity_receipts((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),
  (select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at)) from public.timeline_content where id=(select id from activity_ids where label='late_message')))),'old page acknowledgment cannot clear a later message');
reset role;
select pg_temp.activity_actor((select id from activity_ids where label='author_auth'));
set local role authenticated;
select public.remove_table_member((select id from activity_ids where label='table'),(select id from activity_ids where label='reader_profile'));
reset role;
select pg_temp.activity_actor((select id from activity_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.activity_assert(not exists(select 1 from public.my_table_activity() where group_id=(select id from activity_ids where label='table')),'removed member loses activity');
reset role;
select pg_temp.activity_actor((select id from activity_ids where label='author_auth'));
set local role authenticated;
select public.add_table_members((select id from activity_ids where label='table'),array[(select id from activity_ids where label='reader_profile')]);
select public.leave_table((select id from activity_ids where label='other_table'),null,true);
reset role;
select pg_temp.activity_actor((select id from activity_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.activity_assert((select count(*)=1 from public.my_table_activity()),'closed Table hidden');
select pg_temp.activity_assert((select unread_count=1 and kind='added' from public.my_table_activity()),'rejoin has one new addition, not old history');
select public.ack_table_activity((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),array[(select id from activity_ids where label='old_receipt')]);
select pg_temp.activity_assert((select unread_count=1 from public.my_table_activity()),'old membership acknowledgment cannot clear new addition');
select public.set_follow((select id from activity_ids where label='author_profile'),false,2);
select pg_temp.activity_assert(not exists(select 1 from public.my_follow_notifications() where kind='follow_accepted'),'unfollow hides obsolete acceptance');
reset role;

-- Fixture-only recorded erasure cutoff, no Storage calls or Auth deletion.
select pg_temp.activity_actor(null,'service_role');
insert into activity_ids(label,id) select 'reader_erasure',operation_id from public.reserve_account_erasure_record((select id from activity_ids where label='reader_auth'));
select public.begin_recorded_account_erasure((select id from activity_ids where label='reader_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from activity_ids where label='reader_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.activity_assert(not exists(select 1 from private.table_activity_events where recipient_id=(select id from activity_ids where label='reader_profile') or sender_id=(select id from activity_ids where label='reader_profile')),'recipient cutoff scrubs all links');
select pg_temp.activity_assert(not exists(select 1 from private.follow_acceptance_notifications where recipient_id=(select id from activity_ids where label='reader_profile')),'acceptance identity scrubbed');
select pg_temp.activity_actor((select id from activity_ids where label='reader_auth'));
set local role authenticated;
select pg_temp.activity_assert(not exists(select 1 from public.my_table_activity()),'disabled erased account has no activity');
select pg_temp.activity_expect($q$select public.ack_table_activity((select id from activity_ids where label='table'),(select id from activity_ids where label='period'),'{}')$q$,'42501');
reset role;
select pg_temp.activity_actor((select id from activity_ids where label='author_auth'));
set local role authenticated;
select public.add_table_members((select id from activity_ids where label='table'),array[(select id from activity_ids where label='outsider_profile')]);
insert into activity_ids(label,id) values('cutoff_message',public.post_message((select id from activity_ids where label='table'),gen_random_uuid(),'Sender cutoff fixture'));
reset role;
select pg_temp.activity_actor(null,'service_role');
insert into activity_ids(label,id) select 'author_erasure',operation_id from public.reserve_account_erasure_record((select id from activity_ids where label='author_auth'));
select public.begin_recorded_account_erasure((select id from activity_ids where label='author_erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from activity_ids where label='author_erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('d',64),'authToken',repeat('e',64),'mac',repeat('f',64)));
select pg_temp.activity_assert(not exists(select 1 from private.table_activity_events where sender_id=(select id from activity_ids where label='author_profile')),'sender cutoff scrubs links');
select pg_temp.activity_assert(not exists(select 1 from private.table_activity_events where not active and (sender_id is not null or recipient_id is not null or group_id is not null or period_id is not null or entry_id is not null or reply_id is not null)),'cutoff leaves no linked inactive metadata');
set constraints all immediate;
select 'PASS Activity notifications: grouping, retries, mentions, acceptance, stale/loaded reads, access/rejoin/closure and recorded-erasure cutoffs (rolled back)';
rollback;
