-- Run in a surrounding transaction after the candidate migration; fixtures roll back.
set local statement_timeout = '20s';
set local lock_timeout = '3s';
create function pg_temp.preflight_assert(p_ok boolean, p_why text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text);
end $$;
grant execute on function pg_temp.preflight_assert(boolean,text) to authenticated, anon;

insert into auth.users(id, raw_user_meta_data)
  values (gen_random_uuid(), '{"display_name":"Erasure preflight fixture"}'::jsonb);
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where raw_user_meta_data->>'display_name' = 'Erasure preflight fixture'
    order by created_at desc limit 1), true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'authored_plates')::integer = 0,
  'new account has no authored Plates');
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'sole_owner_tables')::integer = 0,
  'new account has no owned Tables');
create temporary table preflight_ids(name text primary key, id uuid) on commit drop;
grant select, insert on preflight_ids to authenticated;
insert into preflight_ids values ('group', public.create_group('Erasure preflight Table'));
insert into preflight_ids values ('plate', public.publish_plate(
  (select id from public.categories where slug = 'meal'), 'Erasure preflight Plate'));
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'authored_plates')::integer = 1,
  'preflight counts the caller Plate');
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'sole_owner_tables')::integer = 1,
  'preflight counts a sole-owner Table');
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'owned_tables')::integer = 1,
  'preflight counts an owned Table');
select pg_temp.preflight_assert(
  public.account_erasure_impact()->'sole_owner_table_details' =
    jsonb_build_array(jsonb_build_object('id', (select id from preflight_ids where name = 'group'),
      'name', 'Erasure preflight Table', 'other_active_members', 0)),
  'preflight identifies the exact sole-owner Table');
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'created_tables')::integer = 1,
  'preflight counts Tables created by the caller');

reset role;
insert into auth.users(id, raw_user_meta_data)
  values (gen_random_uuid(), '{"display_name":"Erasure preflight other account"}'::jsonb);
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users
    where raw_user_meta_data->>'display_name' = 'Erasure preflight other account'
    order by created_at desc limit 1), true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'authored_plates')::integer = 0,
  'other account does not see first account Plate count');
select pg_temp.preflight_assert(
  (public.account_erasure_impact()->>'sole_owner_tables')::integer = 0,
  'other account does not see first account Table count');
select pg_temp.preflight_assert(
  public.account_erasure_impact()->'sole_owner_table_details' = '[]'::jsonb,
  'other account does not see first account Table identity');
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
do $$ begin
  begin
    perform public.account_erasure_impact();
    raise exception 'FAIL: anonymous preflight succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS erasure preflight' as result;
