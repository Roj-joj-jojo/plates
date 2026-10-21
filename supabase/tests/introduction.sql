-- Rollback-only fixtures. No content, Storage, worker ownership or physical deletion.
begin;
create function pg_temp.intro_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Introduction assertion: %',label; end if; end $$;
create function pg_temp.intro_expect(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;
create function pg_temp.intro_actor(actor uuid,kind text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform set_config('request.jwt.claim.role',kind,true);
end $$;
create temporary table intro_ids(label text primary key,id uuid);
grant select on intro_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into intro_ids values('first_auth',gen_random_uuid()),('second_auth',gen_random_uuid());
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'introduction-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Introduction fixture"}' from intro_ids;
insert into intro_ids select replace(i.label,'_auth','_profile'),l.profile_id from intro_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
select pg_temp.intro_assert(not has_function_privilege('anon','public.my_introduction_completed()','EXECUTE'),'anonymous status denied');
select pg_temp.intro_assert(not has_function_privilege('anon','public.complete_introduction()','EXECUTE'),'anonymous completion denied');
select pg_temp.intro_assert(not has_function_privilege('service_role','public.complete_introduction()','EXECUTE'),'worker cannot complete');
select pg_temp.intro_assert(not has_table_privilege('authenticated','private.introduction_preferences','SELECT'),'no preferences directory');
select pg_temp.intro_assert(not has_table_privilege('authenticated','private.introduction_preferences','INSERT'),'no direct client writes');
select pg_temp.intro_assert(not has_table_privilege('service_role','private.introduction_preferences','SELECT'),'no service directory');
select pg_temp.intro_actor(null);
set local role authenticated;
select pg_temp.intro_expect('select public.my_introduction_completed()','42501');
select pg_temp.intro_expect('select public.complete_introduction()','42501');
reset role;

select pg_temp.intro_actor((select id from intro_ids where label='first_auth'));
set local role authenticated;
select pg_temp.intro_assert(not public.my_introduction_completed(),'first account initially unseen');
select public.complete_introduction();
select pg_temp.intro_assert(public.my_introduction_completed(),'completion persists');
select public.complete_introduction();
reset role;
select pg_temp.intro_assert((select count(*)=1 from private.introduction_preferences where profile_id=(select id from intro_ids where label='first_profile')),'repeat completion idempotent');
create temporary table intro_snapshot as select * from private.introduction_preferences where profile_id=(select id from intro_ids where label='first_profile');

select pg_temp.intro_actor((select id from intro_ids where label='second_auth'));
set local role authenticated;
select pg_temp.intro_assert(not public.my_introduction_completed(),'other account unaffected');
select public.complete_introduction();
select pg_temp.intro_assert(public.my_introduction_completed(),'second account independently completed');
reset role;
update public.profiles set state='disabled' where id=(select id from intro_ids where label='second_profile');
set local role authenticated;
select pg_temp.intro_expect('select public.my_introduction_completed()','42501');
select pg_temp.intro_expect('select public.complete_introduction()','42501');
reset role;
update public.profiles set state='active' where id=(select id from intro_ids where label='second_profile');
set local role authenticated;
select pg_temp.intro_assert(public.my_introduction_completed(),'reactivation retains choice');
reset role;

select pg_temp.intro_actor((select id from intro_ids where label='first_auth'));
set local role authenticated;
select pg_temp.intro_assert(public.my_introduction_completed(),'fresh session remembers first choice');
select public.complete_introduction();
reset role;
select pg_temp.intro_assert((select p.dismissed_at=s.dismissed_at from private.introduction_preferences p join intro_snapshot s using(id)),'replay does not rewrite completion');
-- Synthetic receipt only: tests database cutoff, not signing or physical cleanup.
select pg_temp.intro_actor(null,'service_role');
insert into intro_ids select 'erasure',operation_id from public.reserve_account_erasure_record((select id from intro_ids where label='first_auth'));
select public.begin_recorded_account_erasure((select id from intro_ids where label='erasure'),jsonb_build_object(
  'event','intent','operationId',(select id from intro_ids where label='erasure'),'sequence',1,'previous',repeat('0',64),
  'keyVersion','v1','profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.intro_assert(not exists(select 1 from private.introduction_preferences where profile_id=(select id from intro_ids where label='first_profile')),'erasure clears preference identity');
select pg_temp.intro_assert((select p.profile_id is null and p.dismissed_at is null from private.introduction_preferences p join intro_snapshot s using(id)),'erasure clears timestamp');
select pg_temp.intro_actor((select id from intro_ids where label='first_auth'));
set local role authenticated;
select pg_temp.intro_expect('select public.my_introduction_completed()','42501');
select pg_temp.intro_expect('select public.complete_introduction()','42501');
reset role;
set constraints all immediate;
select 'PASS Introduction: completion/replay retries, account isolation, anonymous/disabled/erased denial and cutoff scrubbing (rolled back)';
rollback;
