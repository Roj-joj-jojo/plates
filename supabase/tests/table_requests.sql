\set ON_ERROR_STOP on
-- Local acceptance suite. All synthetic records roll back.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create temporary table m4_actors(name text primary key, auth_id uuid not null default gen_random_uuid(), profile_id uuid) on commit drop;
insert into m4_actors(name) values ('owner'), ('member'), ('outsider');
create temporary table m4_ids(name text primary key, id uuid not null) on commit drop;
create function pg_temp.m4_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.m4_ids where name = p_name;
$$;
create function pg_temp.assert_true(p_value boolean, p_message text) returns void language plpgsql as $$
begin if p_value is distinct from true then raise exception 'FAIL: %', p_message; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_code text, p_message text) returns void language plpgsql as $$
declare actual_code text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate;
    if actual_code = p_code then return; end if;
    raise exception 'FAIL: %, expected %, got %: %', p_message, p_code, actual_code, sqlerrm;
  end;
  raise exception 'FAIL: % unexpectedly succeeded', p_message;
end $$;
do $$ begin execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text); end $$;
grant select on m4_actors to authenticated, anon;
grant select, insert on m4_ids to authenticated;
grant select on m4_ids to anon;
grant execute on function pg_temp.m4_id(text), pg_temp.assert_true(boolean,text),
  pg_temp.expect_error(text,text,text) to authenticated, anon;

select pg_temp.assert_true(current_user = 'postgres', 'local postgres test role');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.requests'::regclass, 'public.menu_request_saves'::regclass)), 'Request tables use RLS');
select pg_temp.assert_true((select 'security_invoker=true'=any(reloptions) from pg_class
  where oid='public.menu_request_context'::regclass), 'Menu Request view uses invoker rights');
select pg_temp.assert_true((select bool_and(p.prosecdef and r.rolname='postgres'
  and 'search_path=""'=any(p.proconfig)) from pg_proc p join pg_roles r on r.oid=p.proowner
  where p.oid in ('public.post_table_request(uuid,uuid,text,text,jsonb,uuid[])'::regprocedure,
    'public.save_table_request(uuid)'::regprocedure)), 'Request RPC ownership and fixed paths');

insert into auth.users(id,raw_user_meta_data)
  select auth_id,jsonb_build_object('display_name','M4 ' || name) from m4_actors;
update m4_actors a set profile_id=l.profile_id from private.profile_auth_links l where l.auth_user_id=a.auth_id;
select set_config('request.jwt.claim.sub',(select auth_id::text from m4_actors where name='owner'),true);
set local role authenticated;
insert into m4_ids values ('table', public.create_group('M4 Request Table'));
insert into m4_ids values ('other_table', public.create_group('M4 Private Table'));
insert into m4_ids values ('request_key', gen_random_uuid());
insert into m4_ids values ('request', public.post_table_request(pg_temp.m4_id('table'),
  pg_temp.m4_id('request_key'), 'Where should we eat?', 'Vegetarian options welcome'));
select pg_temp.assert_true(public.post_table_request(pg_temp.m4_id('table'),
  pg_temp.m4_id('request_key'), 'Where should we eat?', 'Vegetarian options welcome') = pg_temp.m4_id('request'),
  'retry returns original Request');
select pg_temp.expect_error(format(
  'select public.post_table_request(%L::uuid,%L::uuid,%L,%L)',
  pg_temp.m4_id('table'),pg_temp.m4_id('request_key'),'Different question','Vegetarian options welcome'),
  '23505','changed retry rejected');
select pg_temp.assert_true((select count(*) = 1 from public.timeline_entries
  where id = pg_temp.m4_id('request') and kind = 'request' and position = 1), 'one timeline root');
select pg_temp.assert_true((select count(*) = 1 from public.requests
  where entry_id = pg_temp.m4_id('request') and question = 'Where should we eat?'), 'one Request detail');
insert into m4_ids select 'thread',id from public.threads where root_entry_id = pg_temp.m4_id('request');
select pg_temp.assert_true((select root_kind='request' from public.threads
  where id=pg_temp.m4_id('thread')), 'Request has own discussion');
insert into m4_ids values ('owner_reply', public.reply_to_thread(pg_temp.m4_id('thread'),
  gen_random_uuid(), 'Try the market café'));
insert into m4_ids values ('owner_save', public.save_table_request(pg_temp.m4_id('request')));
select pg_temp.assert_true(public.save_table_request(pg_temp.m4_id('request')) = pg_temp.m4_id('owner_save'),
  'repeat save keeps one Menu item');
select pg_temp.assert_true((select question='Where should we eat?' and group_name='M4 Request Table'
  and context='Vegetarian options welcome' and source_available
  from public.menu_request_context where save_id=pg_temp.m4_id('owner_save')), 'Menu shows live accessible source');
select pg_temp.expect_error(format('insert into public.requests(entry_id,question) values (%L::uuid,%L)',
  pg_temp.m4_id('request'),'Wrong'), '42501', 'direct Request insert denied');
reset role;

select id from public.profiles where id in (select profile_id from m4_actors) order by id for share;
select id from public.groups where id=pg_temp.m4_id('table') for update;
insert into public.group_memberships(group_id,user_id,role,state)
  select pg_temp.m4_id('table'),profile_id,'member','active' from m4_actors where name='member';
insert into public.membership_periods(group_id,user_id,joined_at)
  select pg_temp.m4_id('table'),profile_id,'2026-01-01T00:00:00Z' from m4_actors where name='member';
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claim.sub',(select auth_id::text from m4_actors where name='member'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.requests where entry_id=pg_temp.m4_id('request')),
  'member reads earlier Request');
insert into m4_ids values ('member_reply', public.reply_to_thread(pg_temp.m4_id('thread'),
  gen_random_uuid(), 'I can check opening hours'));
insert into m4_ids values ('member_save', public.save_table_request(pg_temp.m4_id('request')));
select pg_temp.assert_true((select count(*)=2 from public.reply_content
  where thread_id=pg_temp.m4_id('thread')), 'member sees current replies');
select pg_temp.assert_true((select count(*)=1 from public.menu_request_context
  where save_id=pg_temp.m4_id('member_save') and source_available), 'member Menu opens current thread');
select pg_temp.expect_error(format('select public.post_table_request(%L::uuid,gen_random_uuid(),%L)',
  pg_temp.m4_id('other_table'), 'Private question'), '42501', 'member cannot post to another Table');
reset role;

select set_config('request.jwt.claim.sub',(select auth_id::text from m4_actors where name='outsider'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.requests where entry_id=pg_temp.m4_id('request')),
  'outsider cannot read question');
select pg_temp.assert_true((select count(*)=0 from public.timeline_content where id=pg_temp.m4_id('request')),
  'outsider cannot read context');
select pg_temp.assert_true((select count(*)=0 from public.thread_replies where thread_id=pg_temp.m4_id('thread')),
  'outsider cannot read replies');
select pg_temp.assert_true((select count(*)=0 from public.menu_request_saves), 'outsider cannot read another Menu');
select pg_temp.expect_error(format('select public.save_table_request(%L::uuid)',pg_temp.m4_id('request')),
  '42501','outsider cannot save Request');
select pg_temp.expect_error(format('select public.reply_to_thread(%L::uuid,gen_random_uuid(),%L)',
  pg_temp.m4_id('thread'),'Intrusion'), '42501','outsider cannot reply');
reset role;
set constraints all immediate;
select 'PASS: Table Request SQL acceptance checks completed; all fixtures rolled back' as result;
rollback;
