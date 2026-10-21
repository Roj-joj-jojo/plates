-- Run after candidate migration inside a surrounding transaction; fixtures roll back.
set local statement_timeout = '20s';
set local lock_timeout = '3s';
create temporary table visibility_ids(name text primary key, id uuid) on commit drop;
create function pg_temp.visibility_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.visibility_ids where name = p_name;
$$;
create function pg_temp.visibility_assert(p_ok boolean, p_why text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text);
end $$;
grant select, insert on visibility_ids to authenticated;
grant execute on function pg_temp.visibility_id(text),
  pg_temp.visibility_assert(boolean,text) to authenticated, anon;

insert into auth.users(id, raw_user_meta_data) values
  (gen_random_uuid(), '{"display_name":"Visibility owner fixture"}'::jsonb),
  (gen_random_uuid(), '{"display_name":"Visibility peer fixture"}'::jsonb),
  (gen_random_uuid(), '{"display_name":"Visibility stranger fixture"}'::jsonb);
insert into visibility_ids
  select name, id from (values
    ('owner', 'Visibility owner fixture'),
    ('peer', 'Visibility peer fixture'),
    ('stranger', 'Visibility stranger fixture')) v(name, label)
  join auth.users u on u.raw_user_meta_data->>'display_name' = v.label;
insert into visibility_ids
  select v.name || '_profile', l.profile_id
  from visibility_ids v join private.profile_auth_links l on l.auth_user_id = v.id;

select set_config('request.jwt.claim.sub', pg_temp.visibility_id('owner')::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select pg_temp.visibility_assert((select count(*) = 1 from public.profile_directory
  where id in (pg_temp.visibility_id('owner_profile'), pg_temp.visibility_id('peer_profile'),
    pg_temp.visibility_id('stranger_profile'))), 'owner sees only own profile initially');
select pg_temp.visibility_assert((select count(*) = 1 from public.profiles
  where id in (pg_temp.visibility_id('owner_profile'), pg_temp.visibility_id('peer_profile'),
    pg_temp.visibility_id('stranger_profile'))), 'direct profile table is equally restricted');
insert into visibility_ids values ('group', public.create_group('Visibility test Table'));
reset role;

insert into public.group_memberships(group_id,user_id,role,state)
  values (pg_temp.visibility_id('group'), pg_temp.visibility_id('peer_profile'), 'member', 'active');
insert into public.membership_periods(group_id,user_id)
  values (pg_temp.visibility_id('group'), pg_temp.visibility_id('peer_profile'));
set local role authenticated;
select pg_temp.visibility_assert((select count(*) = 2 from public.profile_directory
  where id in (pg_temp.visibility_id('owner_profile'), pg_temp.visibility_id('peer_profile'),
    pg_temp.visibility_id('stranger_profile'))), 'owner sees active Table peer only');
reset role;

select set_config('request.jwt.claim.sub', pg_temp.visibility_id('stranger')::text, true);
set local role authenticated;
select pg_temp.visibility_assert((select count(*) = 0 from public.profile_directory
  where id = pg_temp.visibility_id('owner_profile')), 'unrelated account cannot read owner');
insert into visibility_ids values ('plate', public.publish_plate(
  (select id from public.categories where slug = 'meal'), 'Visibility test Plate'));
reset role;

select set_config('request.jwt.claim.sub', pg_temp.visibility_id('owner')::text, true);
set local role authenticated;
select pg_temp.visibility_assert((select count(*) = 1 from public.profile_directory
  where id = pg_temp.visibility_id('stranger_profile')),
  'owner can read author of a visible Plate');
reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
do $$ begin
  begin
    perform count(*) from public.profile_directory;
    raise exception 'FAIL: anonymous profile query succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS profile visibility' as result;
