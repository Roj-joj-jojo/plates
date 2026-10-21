-- Run with psql against the local Plates database after M1 is applied.
-- Everything, including Auth fixtures and test helpers, rolls back.
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

create temporary table m1_test_actors (
  label text primary key,
  auth_id uuid not null,
  profile_id uuid,
  group_id uuid
) on commit drop;
insert into m1_test_actors(label, auth_id) values
  ('owner', '10000000-0000-4000-8000-000000000001'),
  ('member', '10000000-0000-4000-8000-000000000002'),
  ('outsider', '10000000-0000-4000-8000-000000000003'),
  ('disabled', '10000000-0000-4000-8000-000000000004');

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_condition is distinct from true then
    raise exception 'M1 assertion failed: %', p_message;
  end if;
end;
$$;

-- This temporary, invoker-rights helper runs the statement as the current test
-- role. It must never become an application function or a SECURITY DEFINER.
create function pg_temp.expect_error(p_sql text, p_state text, p_message text)
returns void language plpgsql set search_path = '' as $$
declare actual_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
    if actual_state = p_state then return; end if;
    raise exception 'M1 assertion failed: %, expected SQLSTATE %, got %',
      p_message, p_state, actual_state;
  end;
  raise exception 'M1 assertion failed: %, statement unexpectedly succeeded', p_message;
end;
$$;

-- Grant access to this session's temporary fixtures/helpers, not app internals.
do $$
begin
  execute format('grant usage on schema %I to anon, authenticated',
    pg_my_temp_schema()::regnamespace::text);
end;
$$;
grant select on m1_test_actors to anon, authenticated;
grant execute on function pg_temp.assert_true(boolean, text),
  pg_temp.expect_error(text, text, text) to anon, authenticated;

select pg_temp.assert_true(current_user = 'postgres', 'test setup uses local postgres');
select pg_temp.assert_true(current_setting('server_version_num')::integer >= 150000,
  'server supports invoker views');
select pg_temp.assert_true(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.profiles'::regclass, 'public.groups'::regclass,
    'public.group_memberships'::regclass, 'public.membership_periods'::regclass,
    'private.profile_auth_links'::regclass)), 'all M1 tables enable RLS');
select pg_temp.assert_true(
  (select bool_and(p.prosecdef and r.rolname = 'postgres'
      and 'search_path=""' = any(p.proconfig))
    from pg_proc p join pg_roles r on r.oid = p.proowner
    where p.oid in ('private.current_profile_id()'::regprocedure,
      'private.is_active_member(uuid)'::regprocedure,
      'private.is_group_owner(uuid)'::regprocedure)),
  'membership helpers use expected owner and pinned path');
select pg_temp.assert_true(
  (select 'security_invoker=true' = any(reloptions)
    from pg_class where oid = 'public.profile_directory'::regclass),
  'profile directory uses invoker security');

-- No email addresses/passwords, sessions or outgoing messages are created.
insert into auth.users(id, raw_user_meta_data)
select auth_id, jsonb_build_object('display_name', '  M1 ' || label || '  ',
  'role', 'owner', 'state', 'erased', 'profile_id', 'untrusted-value')
from m1_test_actors;
update m1_test_actors t set profile_id = l.profile_id
  from private.profile_auth_links l where l.auth_user_id = t.auth_id;
set constraints all immediate;
set constraints all deferred;
select pg_temp.assert_true((select count(*) = 4 from m1_test_actors where profile_id is not null),
  'signup creates every private link');
select pg_temp.assert_true(
  (select bool_and(p.state = 'active' and p.id <> t.auth_id and p.display_name = 'M1 ' || t.label)
    from m1_test_actors t join public.profiles p on p.id = t.profile_id),
  'signup generates separate app IDs, trims names and ignores forged state/role');
select pg_temp.assert_true(
  not exists (select 1 from public.group_memberships m join m1_test_actors t on t.profile_id = m.user_id),
  'signup metadata cannot grant membership');

select pg_temp.expect_error($test$
  insert into auth.users(id, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000099', '{}')
$test$, '23514', 'missing display name fails signup');
select pg_temp.expect_error($test$
  insert into auth.users(id, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000099', '{"display_name":123}')
$test$, '23514', 'non-string display name fails signup');
select pg_temp.expect_error($test$
  insert into auth.users(id, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000099', '{"display_name":"   "}')
$test$, '23514', 'empty trimmed name fails signup');
select pg_temp.expect_error($test$
  insert into auth.users(id, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000099', jsonb_build_object('display_name', repeat('x',81)))
$test$, '23514', 'overlong display name fails signup');
select pg_temp.assert_true(
  not exists (select 1 from auth.users where id = '10000000-0000-4000-8000-000000000099')
  and not exists (select 1 from private.profile_auth_links where auth_user_id = '10000000-0000-4000-8000-000000000099'),
  'failed signup leaves neither Auth user nor private link');
select pg_temp.expect_error($test$
  do $case$ begin
    insert into public.profiles(display_name) values ('M1 orphan');
    set constraints all immediate;
  end $case$;
$test$, '23514', 'active profile without Auth link fails deferred check');
set constraints all deferred;
\echo PASS: signup, identity integrity and helper configuration

-- An authenticated RPC derives its actor from auth.uid(), not its input.
select set_config('request.jwt.claim.sub', (select auth_id::text from m1_test_actors where label = 'owner'), true);
set local role authenticated;
select pg_temp.assert_true(private.current_profile_id() =
  (select profile_id from pg_temp.m1_test_actors where label = 'owner'), 'resolve only caller profile');
select public.create_group('  M1 owner table  ');
select public.update_display_name('  M1 renamed owner  ');
select pg_temp.expect_error('select public.update_display_name(null)', '23514', 'null name rejected');
select pg_temp.expect_error('select public.create_group(''   '')', '23514', 'blank Table rejected');
select pg_temp.expect_error('select auth_user_id from private.profile_auth_links', '42501', 'private Auth mapping denied');
select pg_temp.expect_error('select state from public.profiles', '42501', 'profile state column denied');
select pg_temp.expect_error('select next_entry_position from public.groups', '42501', 'counter column denied');
select pg_temp.expect_error('update public.groups set next_entry_position = 99', '42501', 'counter write denied');
select pg_temp.expect_error('update public.groups set availability = ''erased''', '42501', 'availability write denied');
select pg_temp.expect_error('update public.profiles set state = ''erased''', '42501', 'profile state write denied');
select pg_temp.expect_error('insert into public.group_memberships default values', '42501', 'direct membership grant denied');
select pg_temp.expect_error('insert into public.membership_periods default values', '42501', 'direct period write denied');
select pg_temp.expect_error('select private.handle_auth_user_created()', '42501', 'trigger cannot be invoked by client');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.groups','DELETE')
  and not has_table_privilege('authenticated','public.groups','TRUNCATE'), 'no delete/truncate grants');
reset role;
set constraints all immediate;
set constraints all deferred;
update m1_test_actors t set group_id = g.id from public.groups g
  where t.label = 'owner' and g.created_by = t.profile_id;
select pg_temp.assert_true(
  (select count(*) = 1 from public.groups g join m1_test_actors t on t.group_id = g.id),
  'one successful Table and no partial blank Table');
select pg_temp.assert_true(
  (select count(*) = 1 from public.membership_periods p join m1_test_actors t
    on t.group_id = p.group_id where t.label = 'owner' and p.ended_at is null),
  'Table creation opens owner membership period');
select pg_temp.assert_true(
  (select display_name = 'M1 member' from public.profiles p
    join m1_test_actors t on t.profile_id = p.id where t.label = 'member'),
  'rename cannot change another profile');
\echo PASS: controlled writes and column restrictions

-- Privileged fixture administration follows profiles -> group guard order.
select id from public.profiles where id in (select profile_id from m1_test_actors)
  order by id for share;
select id from public.groups where id = (select group_id from m1_test_actors where label = 'owner') for update;
insert into public.group_memberships(group_id, user_id, role, state)
select o.group_id, m.profile_id, 'member', 'active'
  from m1_test_actors o cross join m1_test_actors m where o.label = 'owner' and m.label = 'member';
insert into public.membership_periods(group_id, user_id, joined_at)
select o.group_id, m.profile_id, '2026-01-01T00:00:00Z'::timestamptz
  from m1_test_actors o cross join m1_test_actors m where o.label = 'owner' and m.label = 'member';
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claim.sub', (select auth_id::text from m1_test_actors where label = 'member'), true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.groups), 'member sees own Table');
select pg_temp.assert_true((select count(*) = 2 from public.group_memberships), 'membership read is non-recursive');
select pg_temp.assert_true((select count(*) = 1 from public.membership_periods), 'member sees only own periods');
select pg_temp.assert_true((select count(*) = 4 from public.profile_directory
  where id in (select profile_id from pg_temp.m1_test_actors)), 'invoker directory reads allowed profile fields');
reset role;

select set_config('request.jwt.claim.sub', (select auth_id::text from m1_test_actors where label = 'outsider'), true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.groups), 'outsider sees no Tables');
select pg_temp.assert_true((select count(*) = 0 from public.group_memberships), 'outsider sees no membership list');
select pg_temp.assert_true((select count(*) = 0 from public.membership_periods), 'outsider sees no membership history');
select pg_temp.assert_true(not private.is_active_member(
  (select group_id from pg_temp.m1_test_actors where label = 'owner')), 'known group ID grants no access');
reset role;

update public.profiles set state = 'disabled'
  where id = (select profile_id from m1_test_actors where label = 'disabled');
select set_config('request.jwt.claim.sub', (select auth_id::text from m1_test_actors where label = 'disabled'), true);
set local role authenticated;
select pg_temp.assert_true(private.current_profile_id() is null, 'disabled identity is unusable');
select pg_temp.assert_true((select count(*) = 0 from public.profile_directory), 'invoker view retains caller RLS');
select pg_temp.assert_true((select count(*) = 0 from public.profiles), 'base profile read also retains RLS');
select pg_temp.expect_error('select public.create_group(''M1 blocked'')', '42501', 'disabled user cannot create Table');
select pg_temp.expect_error('select public.update_display_name(''M1 blocked'')', '42501', 'disabled user cannot rename');
reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select pg_temp.expect_error('select id from public.profiles', '42501', 'anonymous profile read denied');
select pg_temp.expect_error('select id from public.profile_directory', '42501', 'anonymous view read denied');
select pg_temp.expect_error('select public.create_group(''M1 anonymous'')', '42501', 'anonymous create denied');
reset role;
\echo PASS: member, outsider, disabled and anonymous access

-- Deferred invariants are forced before outer ROLLBACK, not silently skipped.
select pg_temp.expect_error($test$
  do $case$ begin
    insert into public.groups(name, created_by)
      select 'M1 ownerless', profile_id from pg_temp.m1_test_actors where label = 'owner';
    set constraints all immediate;
  end $case$;
$test$, '23514', 'available group must have owner');
set constraints all deferred;
select pg_temp.expect_error($test$
  do $case$ begin
    update public.group_memberships set role = 'member'
      where user_id = (select profile_id from pg_temp.m1_test_actors where label = 'owner');
    set constraints all immediate;
  end $case$;
$test$, '23514', 'last owner cannot be demoted');
set constraints all deferred;
select pg_temp.expect_error($test$
  do $case$ begin
    update public.group_memberships set state = 'left'
      where user_id = (select profile_id from pg_temp.m1_test_actors where label = 'member');
    set constraints all immediate;
  end $case$;
$test$, '23514', 'inactive member cannot retain open period');
set constraints all deferred;
select pg_temp.expect_error($test$
  do $case$ begin
    update public.membership_periods set ended_at = '2026-02-01T00:00:00Z', end_reason = 'left'
      where user_id = (select profile_id from pg_temp.m1_test_actors where label = 'member');
    set constraints all immediate;
  end $case$;
$test$, '23514', 'active member must retain open period');
set constraints all deferred;
select pg_temp.expect_error($test$
  insert into public.membership_periods(group_id, user_id)
    select group_id, user_id from public.group_memberships where role = 'owner'
$test$, '23505', 'duplicate open period rejected');

-- Leave and rejoin fixtures exercise append-only history and current-state RLS.
update public.membership_periods set ended_at = '2026-02-01T00:00:00Z', end_reason = 'left'
  where user_id = (select profile_id from m1_test_actors where label = 'member');
update public.group_memberships set state = 'left'
  where user_id = (select profile_id from m1_test_actors where label = 'member');
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub', (select auth_id::text from m1_test_actors where label = 'member'), true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.groups), 'former member loses Table read');
select pg_temp.assert_true((select count(*) = 0 from public.group_memberships), 'former member loses membership list');
select pg_temp.assert_true((select count(*) = 1 from public.membership_periods), 'subject retains own historical period');
reset role;

select pg_temp.expect_error($test$
  update public.membership_periods set ended_at = null, end_reason = null
    where user_id = (select profile_id from pg_temp.m1_test_actors where label = 'member')
$test$, '23514', 'closed period cannot reopen');
select pg_temp.expect_error($test$
  do $case$ begin
    insert into public.membership_periods(group_id,user_id,joined_at,ended_at,end_reason)
      select group_id,user_id,'2026-01-15T00:00:00Z','2026-01-20T00:00:00Z','left'
      from public.group_memberships where user_id =
        (select profile_id from pg_temp.m1_test_actors where label = 'member');
    set constraints all immediate;
  end $case$;
$test$, '23514', 'overlapping historical periods rejected');
set constraints all deferred;
insert into public.membership_periods(group_id,user_id,joined_at)
  select group_id,user_id,'2026-02-01T00:00:00Z' from public.group_memberships
  where user_id = (select profile_id from m1_test_actors where label = 'member');
update public.group_memberships set state = 'active'
  where user_id = (select profile_id from m1_test_actors where label = 'member');
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.groups), 'rejoining restores Table access');
select pg_temp.assert_true((select count(*) = 2 from public.membership_periods), 'rejoining retains old period');
reset role;

-- Transfer is possible atomically, while ordinary clients have no role-write RPC.
update public.group_memberships set role = 'owner'
  where user_id = (select profile_id from m1_test_actors where label = 'member');
update public.group_memberships set role = 'member'
  where user_id = (select profile_id from m1_test_actors where label = 'owner');
set constraints all immediate;
\echo PASS: deferred state, owner and membership-history invariants

rollback;
\echo PASS: M1 SQL acceptance checks completed; all fixtures rolled back
