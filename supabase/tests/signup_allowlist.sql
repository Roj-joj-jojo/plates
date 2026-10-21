begin;
set local statement_timeout='30s';
create function pg_temp.admission_assert(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',why; end if; end $$;
create temporary table admission_ids(label text primary key,id uuid);
grant select,insert on admission_ids to authenticated;
insert into admission_ids values('owner_auth',gen_random_uuid()),('peer_auth',gen_random_uuid()),('new_auth',gen_random_uuid());
-- Model pre-existing accounts before activation, without touching real settings.
update private.app_admission_settings set enabled=false,owner_profile_id=null where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'allowlist-'||label||'-'||id||'@example.test',clock_timestamp(),'{"display_name":"Allowlist SQL fixture"}'
  from admission_ids where label in ('owner_auth','peer_auth');
insert into admission_ids select 'owner_profile',profile_id from private.profile_auth_links
  where auth_user_id=(select id from admission_ids where label='owner_auth');
select set_config('request.jwt.claim.role','service_role',true);
select public.activate_signup_allowlist((select id from admission_ids where label='owner_profile'));
select public.activate_signup_allowlist((select id from admission_ids where label='owner_profile'));
select pg_temp.admission_assert((select enabled from private.app_admission_settings),'guard activated');
select pg_temp.admission_assert(not has_table_privilege('authenticated','private.signup_allowlist','SELECT'),'email table private');
select pg_temp.admission_assert(not has_function_privilege('authenticated','public.activate_signup_allowlist(uuid)','EXECUTE'),'clients cannot appoint owner');
select pg_temp.admission_assert(not has_function_privilege('anon','public.list_signup_allowlist()','EXECUTE'),'anonymous list denied');
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from admission_ids where label='peer_auth'),true);
set local role authenticated;
select pg_temp.admission_assert((public.app_access_status()->>'can_manage')::boolean=false,'ordinary account is not app owner');
do $$ begin
  begin perform public.allow_signup_email('outsider@example.test'); raise exception 'FAIL: peer added email';
    exception when insufficient_privilege then null; end;
  begin perform public.list_signup_allowlist(); raise exception 'FAIL: peer read emails';
    exception when insufficient_privilege then null; end;
  begin perform public.withdraw_signup_email(gen_random_uuid()); raise exception 'FAIL: peer withdrew permission';
    exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from admission_ids where label='owner_auth'),true);
set local role authenticated;
select pg_temp.admission_assert((public.app_access_status()->>'can_manage')::boolean,'owner can manage');
insert into admission_ids values('permission',public.allow_signup_email('  ALLOWED@example.test  '));
select pg_temp.admission_assert(public.allow_signup_email('allowed@example.test')=(select id from admission_ids where label='permission'),'normalised add retry stable');
select pg_temp.admission_assert((select count(*)=1 from public.list_signup_allowlist() where email='allowed@example.test' and allowed),'owner sees only pending address');
select public.withdraw_signup_email((select id from admission_ids where label='permission'));
select public.withdraw_signup_email((select id from admission_ids where label='permission'));
reset role;
do $$ begin
  begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'unlisted@example.test','{"display_name":"Denied"}');
    raise exception 'FAIL: direct unlisted signup accepted'; exception when insufficient_privilege then null; end;
  begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'allowed@example.test','{"display_name":"Denied"}');
    raise exception 'FAIL: withdrawn signup accepted'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select pg_temp.admission_assert(public.allow_signup_email('allowed@example.test')=(select id from admission_ids where label='permission'),'reallow reuses entry');
reset role;
-- Existing signup validation must roll back consumption if account creation fails.
do $$ begin
  begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'allowed@example.test','{}');
    raise exception 'FAIL: invalid signup accepted'; exception when check_violation then null; end;
end $$;
select pg_temp.admission_assert((select allowed from private.signup_allowlist where id=(select id from admission_ids where label='permission')),'failed signup preserves permission');
insert into auth.users(id,email,raw_user_meta_data) values((select id from admission_ids where label='new_auth'),
  'allowed@example.test','{"display_name":"Allowlist admitted SQL fixture"}');
select pg_temp.admission_assert((select email is null and not allowed and consumed_auth_id=(select id from admission_ids where label='new_auth')
  from private.signup_allowlist where id=(select id from admission_ids where label='permission')),'signup consumes permission and clears duplicate email');
set local role authenticated;
select pg_temp.admission_assert(not exists(select 1 from public.list_signup_allowlist() where id=(select id from admission_ids where label='permission')),'consumed permission leaves pending list');
reset role;
do $$ begin
  begin insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),'allowed@example.test','{"display_name":"Denied reuse"}');
    raise exception 'FAIL: consumed permission reused'; exception when insufficient_privilege then null; end;
end $$;
-- Exercise real recorded erasure cutoff without Storage/Auth deletion.
select set_config('request.jwt.claim.role','service_role',true);
insert into admission_ids select 'new_profile',profile_id from private.profile_auth_links
  where auth_user_id=(select id from admission_ids where label='new_auth');
insert into admission_ids select 'erasure_operation',operation_id from public.reserve_account_erasure_record(
  (select id from admission_ids where label='new_auth'));
select public.begin_recorded_account_erasure((select id from admission_ids where label='erasure_operation'),
  jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent',
    'operationId',(select id from admission_ids where label='erasure_operation'),
    'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.admission_assert((select consumed_auth_id is null from private.signup_allowlist
  where id=(select id from admission_ids where label='permission')),'erasure clears consumed Auth identity');
select pg_temp.admission_assert(exists(select 1 from auth.users where id=(select id from admission_ids where label='peer_auth')),'existing peer remains');
-- Erasing the operator clears attribution and owner authority in the same cutoff.
insert into admission_ids select 'owner_erasure',operation_id from public.reserve_account_erasure_record(
  (select id from admission_ids where label='owner_auth'));
select public.begin_recorded_account_erasure((select id from admission_ids where label='owner_erasure'),
  jsonb_build_object('sequence',2,'previous',repeat('0',64),'keyVersion','v1','event','intent',
    'operationId',(select id from admission_ids where label='owner_erasure'),
    'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.admission_assert((select owner_profile_id is null and enabled from private.app_admission_settings),'erased owner removed; gate remains closed');
select pg_temp.admission_assert(not exists(select 1 from private.signup_allowlist where created_by=(select id from admission_ids where label='owner_profile')),'erasure clears inviter attribution');
set constraints all immediate;
select 'PASS signup allowlist: owner-only controls, private emails, direct signup guard, normalisation/retries, withdrawal/reallow, failed-signup rollback, one-use admission and recorded-erasure compatibility' as result;
rollback;
