begin;
set local statement_timeout='30s';
create function pg_temp.check_admin(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',why; end if; end $$;
create temporary table admin_ids(label text primary key,id uuid);
grant select,insert on admin_ids to authenticated;
insert into admin_ids values('owner_auth',gen_random_uuid()),('target_auth',gen_random_uuid()),('peer_auth',gen_random_uuid());
update private.app_admission_settings set enabled=false,owner_profile_id=null where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'admin-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Admin SQL fixture"}' from admin_ids;
insert into admin_ids select replace(i.label,'_auth','_profile'),l.profile_id from admin_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
select set_config('request.jwt.claim.role','service_role',true);
select public.activate_signup_allowlist((select id from admin_ids where label='owner_profile'));
select pg_temp.check_admin(not has_function_privilege('anon','public.admin_live_accounts()','EXECUTE'),'anonymous list denied');
select pg_temp.check_admin(not has_table_privilege('authenticated','private.account_activity','SELECT'),'activity table private');
select pg_temp.check_admin(not has_function_privilege('authenticated','public.reserve_admin_account_erasure(uuid,uuid)','EXECUTE'),'client reservation denied');
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from admin_ids where label='peer_auth'),true);
set local role authenticated;
select public.record_account_activity();
do $$ begin
  begin perform public.admin_live_accounts(); raise exception 'FAIL peer list'; exception when insufficient_privilege then null; end;
  begin perform public.admin_account_deletion_scope((select id from admin_ids where label='target_profile')); raise exception 'FAIL peer preview'; exception when insufficient_privilege then null; end;
  begin perform public.admin_account_cleanup_authorised((select id from admin_ids where label='target_profile')); raise exception 'FAIL peer retry'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.check_admin((select count(*)=1 from private.account_activity where profile_id in(select id from admin_ids)),'activity writes caller only');
select set_config('request.jwt.claim.sub',(select id::text from admin_ids where label='owner_auth'),true);
set local role authenticated;
select pg_temp.check_admin((select count(*)=3 from public.admin_live_accounts() where profile_id in(select id from admin_ids)),'owner sees live fixtures');
select pg_temp.check_admin((public.admin_account_deletion_scope((select id from admin_ids where label='target_profile'))->>'profile_id')::uuid=(select id from admin_ids where label='target_profile'),'target preview');
select pg_temp.check_admin((public.app_access_status()->>'can_manage')::boolean,'preview restores caller');
do $$ begin
  begin perform public.admin_account_deletion_scope((select id from admin_ids where label='owner_profile')); raise exception 'FAIL owner preview'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ begin
  begin perform public.reserve_admin_account_erasure((select id from admin_ids where label='peer_auth'),(select id from admin_ids where label='target_profile')); raise exception 'FAIL peer reservation'; exception when insufficient_privilege then null; end;
  begin perform public.reserve_admin_account_erasure((select id from admin_ids where label='owner_auth'),(select id from admin_ids where label='owner_profile')); raise exception 'FAIL owner reservation'; exception when insufficient_privilege then null; end;
end $$;
insert into admin_ids select 'target_op',operation_id from public.reserve_admin_account_erasure((select id from admin_ids where label='owner_auth'),(select id from admin_ids where label='target_profile'));
select public.begin_admin_recorded_erasure((select id from admin_ids where label='owner_auth'),(select id from admin_ids where label='target_op'),
  jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent','operationId',(select id from admin_ids where label='target_op'),'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
insert into admin_ids select 'peer_op',operation_id from public.reserve_admin_account_erasure((select id from admin_ids where label='owner_auth'),(select id from admin_ids where label='peer_profile'));
select public.begin_admin_recorded_erasure((select id from admin_ids where label='owner_auth'),(select id from admin_ids where label='peer_op'),
  jsonb_build_object('sequence',2,'previous',repeat('0',64),'keyVersion','v1','event','intent','operationId',(select id from admin_ids where label='peer_op'),'profileToken',repeat('d',64),'authToken',repeat('e',64),'mac',repeat('f',64)));
select pg_temp.check_admin((select last_active_at is null from private.account_activity where profile_id=(select id from admin_ids where label='peer_profile')),'cutoff clears activity');
insert into private.account_erasure_objects(profile_id,bucket_id,object_path)
  select id,'plate-media','synthetic/'||id||'.jpg' from admin_ids where label in('target_profile','peer_profile');
select pg_temp.check_admin((select count(*)=1 from public.erasure_claim_objects_for((select id from admin_ids where label='target_profile'))),'scoped claim selects only target');
select pg_temp.check_admin((select state='pending' from private.account_erasure_objects where profile_id=(select id from admin_ids where label='peer_profile')),'other job untouched');
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from admin_ids where label='owner_auth'),true);
set local role authenticated;
select pg_temp.check_admin(public.admin_account_cleanup_authorised((select id from admin_ids where label='target_profile')),'owner may resume pending cleanup');
select pg_temp.check_admin((select state='active' and is_owner from public.admin_live_accounts() where profile_id=(select id from admin_ids where label='owner_profile')),'owner preserved');
reset role;
set constraints all immediate;
select 'PASS admin account management: owner-only list/preview/retry, caller restoration, private activity/cutoff, service-only reservation, owner protection, independent receipt cutoff and scoped claims' as result;
rollback;
