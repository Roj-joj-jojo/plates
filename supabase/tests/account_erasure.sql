-- Run against the applied local schema or through scripts/test-account-erasure-candidate.mjs,
-- which wraps this suite and the unapplied migration in one rollback-only transaction.
-- Every synthetic fixture and account transition in this file rolls back.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
create function pg_temp.erasure_assert(p_ok boolean, p_why text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, service_role',
    pg_my_temp_schema()::regnamespace::text);
end $$;
grant execute on function pg_temp.erasure_assert(boolean,text) to authenticated, service_role;
create temporary table erasure_test_ids(name text primary key, id uuid) on commit drop;
grant select, insert on erasure_test_ids to authenticated;
grant select on erasure_test_ids to service_role;

-- The SQL suite models the trusted server receipt; filesystem durability is tested
-- by the coordinator suite and the separately approved real integration drill.
create function pg_temp.test_recorded_begin(p_auth uuid)
returns uuid language plpgsql as $$
declare reservation record; payload jsonb;
begin
  select * into reservation from public.reserve_account_erasure_record(p_auth);
  payload := jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent',
    'operationId',reservation.operation_id,'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64));
  return public.begin_recorded_account_erasure(reservation.operation_id,payload);
end $$;
grant execute on function pg_temp.test_recorded_begin(uuid) to service_role;

insert into auth.users(id, raw_user_meta_data)
  values (gen_random_uuid(), '{"display_name":"Erasure SQL author"}'::jsonb),
         (gen_random_uuid(), '{"display_name":"Erasure SQL peer"}'::jsonb);
insert into erasure_test_ids
  select 'author_auth', id from auth.users
    where raw_user_meta_data->>'display_name' = 'Erasure SQL author';
insert into erasure_test_ids
  select 'peer_auth', id from auth.users
    where raw_user_meta_data->>'display_name' = 'Erasure SQL peer';
insert into erasure_test_ids
  select 'author_profile', profile_id from private.profile_auth_links
    where auth_user_id = (select id from erasure_test_ids where name = 'author_auth');
insert into erasure_test_ids
  select 'peer_profile', profile_id from private.profile_auth_links
    where auth_user_id = (select id from erasure_test_ids where name = 'peer_auth');

select set_config('request.jwt.claim.sub',
  (select id::text from erasure_test_ids where name = 'author_auth'), true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into erasure_test_ids values ('group', public.create_group('Erasure SQL Table'));
insert into erasure_test_ids values ('continuing_group', public.create_group('Erasure SQL Shared Table'));
insert into erasure_test_ids values ('plate', public.publish_plate(
  (select id from public.categories where slug = 'meal'), 'Erasure SQL Plate'));
insert into erasure_test_ids values ('request', public.post_table_request(
  (select id from erasure_test_ids where name = 'group'), gen_random_uuid(),
  'Erasure SQL question', 'Erasure SQL context'));
reset role;

insert into public.group_memberships(group_id, user_id, role, state)
  values ((select id from erasure_test_ids where name = 'group'),
    (select id from erasure_test_ids where name = 'peer_profile'), 'member', 'active');
insert into public.membership_periods(group_id, user_id)
  values ((select id from erasure_test_ids where name = 'group'),
    (select id from erasure_test_ids where name = 'peer_profile'));
insert into public.group_memberships(group_id, user_id, role, state)
  values ((select id from erasure_test_ids where name = 'continuing_group'),
    (select id from erasure_test_ids where name = 'peer_profile'), 'owner', 'active');
insert into public.membership_periods(group_id, user_id)
  values ((select id from erasure_test_ids where name = 'continuing_group'),
    (select id from erasure_test_ids where name = 'peer_profile'));
insert into public.thread_replies(thread_id, group_id, author_id, body, position,
  client_request_id, request_fingerprint)
  select t.id, t.group_id, (select id from erasure_test_ids where name = 'peer_profile'),
    'Independent peer reply', 1, gen_random_uuid(), repeat('a', 64)
    from public.threads t where t.root_entry_id =
      (select id from erasure_test_ids where name = 'request');
insert into public.media_upload_intents(uploader_id, staged_path)
  values ((select id from erasure_test_ids where name = 'author_profile'),
    (select id::text from erasure_test_ids where name = 'author_profile') || '/erasure-sql-fixture');
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select public.register_media_object_attempt('plate-media', 'erasure-sql-orphan.webp',
  (select id from erasure_test_ids where name = 'author_profile'));
reset role;

select set_config('request.jwt.claim.sub',
  (select id::text from erasure_test_ids where name = 'peer_auth'), true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.save_plate((select id from erasure_test_ids where name = 'plate'), 1);
reset role;

select set_config('request.jwt.claim.sub',
  (select id::text from erasure_test_ids where name = 'author_auth'), true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ begin
  begin
    perform public.begin_account_erasure();
    raise exception 'FAIL: unrecorded direct request accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select pg_temp.erasure_assert(pg_temp.test_recorded_begin((select id from erasure_test_ids where name='author_auth')) =
  (select id from erasure_test_ids where name = 'author_profile'), 'self-erasure returns caller');
reset role;
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.erasure_assert(private.current_profile_id() is null,
  'disabled account immediately loses profile access');
do $$ begin
  begin
    perform public.erasure_worker_jobs();
    raise exception 'FAIL: client called worker RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.erasure_assert((select state = 'disabled' and display_name is null
  from public.profiles where id = (select id from erasure_test_ids where name = 'author_profile')),
  'profile disabled and name blank');
select pg_temp.erasure_assert((select availability = 'erased' and author_id is null
  and body = '' from public.plates where id = (select id from erasure_test_ids where name = 'plate')),
  'authored Plate blanked');
select pg_temp.erasure_assert((select availability = 'erased' and name is null and created_by is null
  from public.groups where id = (select id from erasure_test_ids where name = 'group')),
  'sole-owner Table archived');
select pg_temp.erasure_assert((select availability = 'available' and name = 'Table'
  and created_by = (select id from erasure_test_ids where name = 'peer_profile')
  from public.groups where id = (select id from erasure_test_ids where name = 'continuing_group')),
  'Table with another owner continues with transferred attribution');
select pg_temp.erasure_assert((select question = '' from public.requests
  where entry_id = (select id from erasure_test_ids where name = 'request')),
  'Request question blanked');
select pg_temp.erasure_assert((select availability = 'erased' and snapshot_body = ''
  and snapshot_author_name = '' from public.menu_plate_saves
  where plate_id = (select id from erasure_test_ids where name = 'plate')),
  'peer Menu copy blanked');
select pg_temp.erasure_assert((select body = 'Independent peer reply' and availability = 'available'
  from public.thread_replies where group_id = (select id from erasure_test_ids where name = 'group')),
  'independent peer reply retained');
select pg_temp.erasure_assert((select state = 'removed' from public.group_memberships
  where group_id = (select id from erasure_test_ids where name = 'group')
    and user_id = (select id from erasure_test_ids where name = 'author_profile')),
  'erased member closed');
select pg_temp.erasure_assert((select count(*) = 1 from private.account_erasure_objects
  where profile_id = (select id from erasure_test_ids where name = 'author_profile')
    and bucket_id = 'staged-assets'), 'staged path queued for cleanup');
select pg_temp.erasure_assert((select count(*) = 1 from private.account_erasure_objects
  where profile_id = (select id from erasure_test_ids where name = 'author_profile')
    and bucket_id = 'plate-media' and object_path = 'erasure-sql-orphan.webp'),
  'unattached processed path queued for cleanup');

select set_config('request.jwt.claim.sub',
  (select id::text from erasure_test_ids where name = 'peer_auth'), true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.erasure_assert(not exists (select 1 from public.groups
  where id = (select id from erasure_test_ids where name = 'group')),
  'peer loses access to archived sole-owner Table');
select pg_temp.erasure_assert(exists (select 1 from public.groups
  where id = (select id from erasure_test_ids where name = 'continuing_group')),
  'peer retains access to Table with another owner');
reset role;

select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
do $$ begin
  begin
    perform public.erasure_advance_identity(
      (select id from erasure_test_ids where name = 'author_profile'));
    raise exception 'FAIL: identity advanced before reconciliation';
  exception when check_violation then null;
  end;
end $$;
select public.erasure_mark_reconciled((select id from erasure_test_ids where name = 'author_profile'));
select pg_temp.erasure_assert((select count(*) = 2 from public.erasure_claim_objects()),
  'worker claims staged and unattached paths');
select pg_temp.erasure_assert((select count(*) = 0 from public.erasure_claim_objects()),
  'fresh cleanup claims are not immediately reclaimed');
reset role;
-- Model a cleanup process disappearing after claiming paths. No Storage API is
-- called; the fixture timestamps and all account transitions roll back.
update private.account_erasure_objects set updated_at = clock_timestamp() - interval '3 minutes'
  where profile_id = (select id from erasure_test_ids where name = 'author_profile');
set local role service_role;
select pg_temp.erasure_assert((select count(*) = 2 from public.erasure_claim_objects()),
  'expired cleanup claims can be recovered after a worker restart');
select public.erasure_object_result(
  (select id from erasure_test_ids where name = 'author_profile'), 'plate-media',
  'erasure-sql-orphan.webp', false, 'Synthetic retry failure');
select pg_temp.erasure_assert((select count(*) = 1 from public.erasure_claim_objects()),
  'failed object removal returns to the retry queue');
select public.erasure_object_result(
  (select id from erasure_test_ids where name = 'author_profile'), 'staged-assets',
  (select id::text from erasure_test_ids where name = 'author_profile') || '/erasure-sql-fixture',
  true);
select public.erasure_object_result(
  (select id from erasure_test_ids where name = 'author_profile'), 'plate-media',
  'erasure-sql-orphan.webp', true);
do $$ begin
  begin
    perform public.erasure_advance_identity(
      (select id from erasure_test_ids where name = 'author_profile'));
    raise exception 'FAIL: identity advanced while upload attempt could still finish';
  exception when check_violation then null;
  end;
end $$;
select public.finish_media_object_attempt('plate-media', 'erasure-sql-orphan.webp');
reset role;
select pg_temp.erasure_assert((select state = 'pending' from private.account_erasure_objects
  where profile_id = (select id from erasure_test_ids where name = 'author_profile')
    and bucket_id = 'plate-media' and object_path = 'erasure-sql-orphan.webp'),
  'finished in-flight path must be checked again after its early removal');
set local role service_role;
select pg_temp.erasure_assert((select count(*) = 1 from public.erasure_claim_objects()),
  'worker reclaims the finished in-flight path');
select public.erasure_object_result(
  (select id from erasure_test_ids where name = 'author_profile'), 'plate-media',
  'erasure-sql-orphan.webp', true);
select public.erasure_mark_reconciled((select id from erasure_test_ids where name = 'author_profile'));
select pg_temp.erasure_assert(public.erasure_advance_identity(
  (select id from erasure_test_ids where name = 'author_profile')) =
  (select id from erasure_test_ids where name = 'author_auth'), 'identity unlinked after cleanup');
select pg_temp.erasure_assert(public.erasure_advance_identity(
  (select id from erasure_test_ids where name = 'author_profile')) =
  (select id from erasure_test_ids where name = 'author_auth'),
  'restarted worker receives the same pending Auth deletion target');
do $$ begin
  begin
    perform public.erasure_auth_removed(
      (select id from erasure_test_ids where name = 'author_profile'));
    raise exception 'FAIL: legacy identity-completion bypass accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.erasure_assert(not exists (select 1 from private.profile_auth_links
  where profile_id = (select id from erasure_test_ids where name = 'author_profile')),
  'private Auth link removed');
select pg_temp.erasure_assert((select state = 'erased' from public.profiles
  where id = (select id from erasure_test_ids where name = 'author_profile')),
  'blank structural profile retained');
set constraints all immediate;
select 'PASS account erasure transaction' as result;
rollback;
