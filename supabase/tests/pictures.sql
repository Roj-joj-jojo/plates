begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.picture_assert(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',why; end if; end $$;
create function pg_temp.picture_expect(sql text,code text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute sql;
  exception when others then
    get stacked diagnostics actual=returned_sqlstate;
    if actual=code then return; end if;
    raise exception 'Expected %, got %',code,actual;
  end;
  raise exception 'Expected %, operation succeeded',code;
end $$;
create temporary table picture_ids(label text primary key,id uuid);
grant select,insert on picture_ids to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into picture_ids values('admin_auth',gen_random_uuid()),('member_auth',gen_random_uuid()),('outsider_auth',gen_random_uuid());
-- Fixture admission changes and accounts exist only inside this rolled-back transaction.
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'picture-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Picture fixture"}' from picture_ids;
insert into picture_ids select replace(i.label,'_auth','_profile'),l.profile_id from picture_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Picture'||replace(id::text,'-','')::varchar(20) from picture_ids where label like '%_profile';
select pg_temp.picture_assert(not has_function_privilege('anon','public.set_picture(text,uuid,uuid,bigint)','EXECUTE'),'anonymous edit denied');
select pg_temp.picture_assert(not has_function_privilege('service_role','public.set_picture(text,uuid,uuid,bigint)','EXECUTE'),'worker cannot edit pictures');
select pg_temp.picture_assert(not has_table_privilege('authenticated','private.profile_pictures','UPDATE'),'no direct edits');
select pg_temp.picture_assert(not has_function_privilege('authenticated','public.claim_picture_cleanup(uuid)','EXECUTE'),'clients cannot claim cleanup');
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from picture_ids where label='admin_auth'),true);
set local role authenticated;
insert into picture_ids values('group',public.create_table_with_members('Picture SQL fixture',array[(select id from picture_ids where label='member_profile')]));
reset role;
-- Processed metadata fixtures only: no Storage objects, real uploads or erasures.
insert into picture_ids values('p1',gen_random_uuid()),('p2',gen_random_uuid()),('t1',gen_random_uuid()),('t2',gen_random_uuid());
insert into public.media_upload_intents(id,uploader_id,staged_path,state)
  select id,(select id from picture_ids where label='admin_profile'),'picture-test/'||id,'processing'
    from picture_ids where label in ('p1','p2','t1','t2');
select set_config('request.jwt.claim.role','service_role',true);
select public.finish_plate_upload(id,id,id::text||'.webp',512,512) from picture_ids where label in ('p1','p2','t1','t2');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.picture_assert(public.set_picture('profile',(select id from picture_ids where label='admin_profile'),(select id from picture_ids where label='p1'),0)=1,'own picture saved');
select pg_temp.picture_assert(public.set_picture('profile',(select id from picture_ids where label='admin_profile'),(select id from picture_ids where label='p1'),0)=1,'same retry idempotent');
select pg_temp.picture_assert(public.set_picture('table',(select id from picture_ids where label='group'),(select id from picture_ids where label='t1'),0)=1,'Admin table picture saved');
select pg_temp.picture_expect($q$select public.set_picture('profile',(select id from picture_ids where label='admin_profile'),(select id from picture_ids where label='p2'),0)$q$,'40001');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from picture_ids where label='member_auth'),true);
set local role authenticated;
select pg_temp.picture_assert((select count(*)=1 from public.picture_locations('profile',array[(select id from picture_ids where label='admin_profile')])),'peer profile picture readable');
select pg_temp.picture_assert((select count(*)=1 from public.picture_locations('table',array[(select id from picture_ids where label='group')])),'member table picture readable');
select pg_temp.picture_assert(private.can_read_picture_object((select id::text||'.webp' from picture_ids where label='t1')),'member object access');
select pg_temp.picture_expect($q$select public.set_picture('profile',(select id from picture_ids where label='admin_profile'),null,1)$q$,'42501');
select pg_temp.picture_expect($q$select public.set_picture('table',(select id from picture_ids where label='group'),null,1)$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from picture_ids where label='outsider_auth'),true);
set local role authenticated;
-- Following's discovery feature makes chosen-username profile avatars visible,
-- while the pre-following schema retains the earlier restricted-profile rule.
select pg_temp.picture_assert((select count(*)=case when to_regprocedure('public.social_ready()') is null then 0 else 1 end
  from public.picture_locations('profile',array[(select id from picture_ids where label='admin_profile')])),'profile avatar obeys the installed discovery rule');
select pg_temp.picture_assert((select count(*)=0 from public.picture_locations('table',array[(select id from picture_ids where label='group')])),'outsider table hidden');
select pg_temp.picture_assert(not private.can_read_picture_object((select id::text||'.webp' from picture_ids where label='t1')),'outsider object denied');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from picture_ids where label='admin_auth'),true);
set local role authenticated;
select public.set_picture('profile',(select id from picture_ids where label='admin_profile'),(select id from picture_ids where label='p2'),1);
select pg_temp.picture_assert(not private.can_read_picture_object((select id::text||'.webp' from picture_ids where label='p1')),'replacement revokes fresh object reads');
select pg_temp.picture_expect($q$select public.set_picture('table',(select id from picture_ids where label='group'),(select id from picture_ids where label='p1'),1)$q$,'23514');
select public.set_picture('table',(select id from picture_ids where label='group'),null,1);
select pg_temp.picture_assert(not private.can_read_picture_object((select id::text||'.webp' from picture_ids where label='t1')),'removal revokes fresh reads');
select public.set_picture('table',(select id from picture_ids where label='group'),(select id from picture_ids where label='t2'),2);
select public.remove_table_member((select id from picture_ids where label='group'),(select id from picture_ids where label='member_profile'));
reset role;
select set_config('request.jwt.claim.sub',(select id::text from picture_ids where label='member_auth'),true);
set local role authenticated;
select pg_temp.picture_assert(not private.can_read_picture_object((select id::text||'.webp' from picture_ids where label='t2')),'removed member object denied');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from picture_ids where label='admin_auth'),true);
set local role authenticated;
select public.leave_table((select id from picture_ids where label='group'),null,true);
reset role;
select pg_temp.picture_assert((select asset_id is null from private.table_pictures where group_id=(select id from picture_ids where label='group')),'closure clears picture');
select pg_temp.picture_assert((select count(*)=3 from private.picture_cleanup where asset_id in (select id from picture_ids where label in ('p1','t1','t2'))),'replacement removal closure queue cleanup');
select set_config('request.jwt.claim.role','service_role',true);
create temporary table picture_cleanup_claimed as select * from public.claim_picture_cleanup((select id from picture_ids where label='admin_profile'));
select pg_temp.picture_assert((select count(*)=3 from picture_cleanup_claimed),'only retired assets claimed');
select public.finish_picture_cleanup(asset_id,false) from picture_cleanup_claimed;
select pg_temp.picture_assert((select count(*)=3 from private.picture_cleanup where state='pending' and asset_id in (select asset_id from picture_cleanup_claimed)),'failed cleanup retryable');
select public.claim_picture_cleanup((select id from picture_ids where label='admin_profile'));
select public.finish_picture_cleanup(asset_id,true) from picture_cleanup_claimed;
-- Exercise the recorded cutoff for this transaction-only fixture. No Auth/Storage deletion.
insert into picture_ids select 'erasure_operation',operation_id from public.reserve_account_erasure_record((select id from picture_ids where label='admin_auth'));
select public.begin_recorded_account_erasure((select id from picture_ids where label='erasure_operation'),
  jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent',
    'operationId',(select id from picture_ids where label='erasure_operation'),
    'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.picture_assert((select asset_id is null from private.profile_pictures where profile_id=(select id from picture_ids where label='admin_profile')),'account cutoff clears picture');
select pg_temp.picture_expect($q$update private.account_erasure_jobs set state='auth_pending' where profile_id=(select id from picture_ids where label='admin_profile')$q$,'23514');
select 'PASS pictures: permissions, privacy, retries, collisions, removal, closure, cutoff and cleanup gates';
rollback;
