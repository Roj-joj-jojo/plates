-- Rollback-only acceptance check for the author identity projection.
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

create temporary table my_profile_actors (
  label text primary key, auth_id uuid not null, profile_id uuid
) on commit drop;
insert into my_profile_actors(label, auth_id) values
  ('owner', '20000000-0000-4000-8000-000000000001'),
  ('other', '20000000-0000-4000-8000-000000000002');

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql set search_path = '' as $$
begin
  if p_condition is distinct from true then raise exception 'my_profile assertion failed: %', p_message; end if;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated', pg_my_temp_schema()::regnamespace::text);
end $$;
grant select on my_profile_actors to authenticated;
grant execute on function pg_temp.assert_true(boolean, text) to authenticated;

select pg_temp.assert_true(current_user = 'postgres', 'local postgres runs setup');
select pg_temp.assert_true(
  (select 'security_invoker=true' = any(reloptions)
    from pg_class where oid = 'public.my_profile'::regclass),
  'view uses invoker security');
select pg_temp.assert_true(has_table_privilege('authenticated', 'public.my_profile', 'SELECT'),
  'authenticated can read own projection');
select pg_temp.assert_true(not has_table_privilege('anon', 'public.my_profile', 'SELECT'),
  'anonymous cannot read identity projection');

insert into auth.users(id, raw_user_meta_data)
select auth_id, jsonb_build_object('display_name', 'Projection ' || label)
from my_profile_actors;
update my_profile_actors a set profile_id = l.profile_id
  from private.profile_auth_links l where l.auth_user_id = a.auth_id;
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claim.sub', (select auth_id::text from my_profile_actors where label = 'owner'), true);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) = 1 from public.my_profile), 'owner sees exactly one row');
select pg_temp.assert_true(
  (select id from public.my_profile) = (select profile_id from my_profile_actors where label = 'owner'),
  'owner sees only own app ID');
reset role;

select set_config('request.jwt.claim.sub', (select auth_id::text from my_profile_actors where label = 'other'), true);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) = 1 from public.my_profile), 'other user sees exactly one row');
select pg_temp.assert_true(
  (select id from public.my_profile) = (select profile_id from my_profile_actors where label = 'other'),
  'other user cannot read owner identity through the view');
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.my_profile),
  'an unverified identity sees no row');
reset role;

rollback;
select 'PASS: my_profile identity projection; all fixtures rolled back' as result;
