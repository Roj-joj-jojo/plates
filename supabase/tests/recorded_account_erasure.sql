begin;
create function pg_temp.record_assert(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',why; end if; end $$;
create temporary table record_ids(label text primary key,id uuid,payload jsonb);
insert into record_ids values('author_auth',gen_random_uuid(),null),('peer_auth',gen_random_uuid(),null);
insert into auth.users(id,raw_user_meta_data) select id,'{"display_name":"Recorded erasure SQL fixture"}' from record_ids;
insert into record_ids select 'author_profile',profile_id,null from private.profile_auth_links where auth_user_id=(select id from record_ids where label='author_auth');
select pg_temp.record_assert(not has_function_privilege('authenticated','public.begin_account_erasure()','EXECUTE'),'direct request privilege denied');
select pg_temp.record_assert(not has_function_privilege('service_role','public.erasure_auth_removed(uuid)','EXECUTE'),'legacy completion privilege denied');
select pg_temp.record_assert(not has_function_privilege('authenticated','public.begin_recorded_account_erasure(uuid,jsonb)','EXECUTE'),'trusted bridge unavailable to client');
select pg_temp.record_assert(not has_table_privilege('service_role','private.account_erasure_records','SELECT'),'private mirror not directly exposed');
select set_config('request.jwt.claim.role','service_role',true);
insert into record_ids select 'operation',operation_id,null from public.reserve_account_erasure_record((select id from record_ids where label='author_auth'));
select pg_temp.record_assert((select state='active' from public.profiles where id=(select id from record_ids where label='author_profile')),'reservation does not cut off access');
select pg_temp.record_assert((select operation_id from public.reserve_account_erasure_record((select id from record_ids where label='author_auth')))=(select id from record_ids where label='operation'),'reservation retry identity stable');
update record_ids set payload=jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent',
  'operationId',id,'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)) where label='operation';
do $$ begin
  begin perform public.begin_recorded_account_erasure((select id from record_ids where label='operation'),'{}');
    raise exception 'FAIL: missing receipt accepted'; exception when check_violation then null; end;
  begin perform public.begin_account_erasure();
    raise exception 'FAIL: internal request without mirrored intent accepted'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.record_assert(not exists(select 1 from private.account_erasure_jobs where profile_id=(select id from record_ids where label='author_profile')),'missing receipt leaves no erasure job');
select pg_temp.record_assert(public.begin_recorded_account_erasure((select id from record_ids where label='operation'),(select payload from record_ids where label='operation'))=(select id from record_ids where label='author_profile'),'acknowledged intent accepted');
select pg_temp.record_assert(public.begin_recorded_account_erasure((select id from record_ids where label='operation'),(select payload from record_ids where label='operation'))=(select id from record_ids where label='author_profile'),'accepted retry idempotent');
do $$ begin
  begin perform public.begin_recorded_account_erasure((select id from record_ids where label='operation'),
    (select payload||'{"mac":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}' from record_ids where label='operation'));
    raise exception 'FAIL: conflicting receipt accepted'; exception when check_violation then null; end;
end $$;
select public.erasure_mark_reconciled((select id from record_ids where label='author_profile'));
select public.erasure_advance_identity((select id from record_ids where label='author_profile'));
update record_ids set payload=payload||jsonb_build_object('event','complete','sequence',2,'mac',repeat('d',64)) where label='operation';
do $$ begin
  begin perform public.complete_recorded_account_erasure((select id from record_ids where label='author_profile'),(select payload from record_ids where label='operation'));
    raise exception 'FAIL: completion before Auth absence accepted'; exception when check_violation then null; end;
end $$;
delete from auth.users where id=(select id from record_ids where label='author_auth');
select public.complete_recorded_account_erasure((select id from record_ids where label='author_profile'),(select payload from record_ids where label='operation'));
select public.complete_recorded_account_erasure((select id from record_ids where label='author_profile'),(select payload from record_ids where label='operation'));
select pg_temp.record_assert((select completion is not null and auth_user_id is null from private.account_erasure_records where profile_id=(select id from record_ids where label='author_profile')),'completion mirrored without raw Auth identity');
select pg_temp.record_assert(exists(select 1 from auth.users where id=(select id from record_ids where label='peer_auth')),'peer Auth preserved');
select 'PASS recorded erasure SQL' as result;
rollback;
