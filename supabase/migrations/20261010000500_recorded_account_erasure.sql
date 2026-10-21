-- Require a trusted server to acknowledge the independent intent before cutoff.
begin;
create table private.account_erasure_records (
  profile_id uuid primary key references public.profiles(id),
  auth_user_id uuid unique,
  operation_id uuid not null unique default gen_random_uuid(),
  intent jsonb,
  completion jsonb,
  accepted_at timestamptz,
  completed_at timestamptz,
  check ((completed_at is null) = (completion is null)),
  check (accepted_at is null or intent is not null)
);
revoke all on private.account_erasure_records from public, anon, authenticated, service_role;

create function public.reserve_account_erasure_record(p_auth_user_id uuid)
returns table(profile_id uuid, operation_id uuid, accepted boolean)
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Trusted erasure server required' using errcode='42501'; end if;
  select r.profile_id into actor from private.account_erasure_records r where r.auth_user_id=p_auth_user_id;
  if actor is null then
    select l.profile_id into actor from private.profile_auth_links l join public.profiles p on p.id=l.profile_id
      where l.auth_user_id=p_auth_user_id and p.state='active' for update of p;
    if actor is null then raise exception 'Active account unavailable' using errcode='42501'; end if;
    insert into private.account_erasure_records(profile_id,auth_user_id) values(actor,p_auth_user_id) on conflict do nothing;
  end if;
  return query select r.profile_id,r.operation_id,r.accepted_at is not null
    from private.account_erasure_records r where r.profile_id=actor and r.auth_user_id=p_auth_user_id;
end $$;

create function private.validate_erasure_record(p_record jsonb,p_event text,p_operation uuid)
returns void language plpgsql set search_path='' as $$
begin
  if p_record is null or jsonb_typeof(p_record)<>'object'
    or (select array_agg(k order by k) from jsonb_object_keys(p_record) k)
      is distinct from array['authToken','event','keyVersion','mac','operationId','previous','profileToken','sequence']::text[]
    or p_record->>'event' is distinct from p_event or p_record->>'operationId' is distinct from p_operation::text
    or p_record->>'keyVersion' is distinct from 'v1'
    or jsonb_typeof(p_record->'sequence') is distinct from 'number'
    or coalesce(p_record->>'sequence','') !~ '^[1-9][0-9]{0,7}$'
    or coalesce(p_record->>'profileToken','') !~ '^[0-9a-f]{64}$'
    or coalesce(p_record->>'authToken','') !~ '^[0-9a-f]{64}$'
    or coalesce(p_record->>'previous','') !~ '^[0-9a-f]{64}$'
    or coalesce(p_record->>'mac','') !~ '^[0-9a-f]{64}$' then
    raise exception 'Independent record receipt invalid' using errcode='23514';
  end if;
end $$;

create function public.begin_recorded_account_erasure(p_operation_id uuid,p_intent jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare receipt private.account_erasure_records%rowtype; result uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Trusted erasure server required' using errcode='42501'; end if;
  select * into receipt from private.account_erasure_records where operation_id=p_operation_id for update;
  if not found then raise exception 'Reserved operation required' using errcode='23514'; end if;
  perform private.validate_erasure_record(p_intent,'intent',p_operation_id);
  if receipt.intent is not null and receipt.intent is distinct from p_intent then
    raise exception 'Receipt conflict' using errcode='23514'; end if;
  if receipt.accepted_at is not null then return receipt.profile_id; end if;
  if not exists(select 1 from private.profile_auth_links where profile_id=receipt.profile_id and auth_user_id=receipt.auth_user_id) then
    raise exception 'Reserved identity mismatch' using errcode='23514'; end if;
  update private.account_erasure_records set intent=p_intent where operation_id=p_operation_id;
  perform set_config('request.jwt.claim.sub',receipt.auth_user_id::text,true);
  result := public.begin_account_erasure();
  if result is distinct from receipt.profile_id then raise exception 'Erasure identity mismatch' using errcode='23514'; end if;
  update private.account_erasure_records set accepted_at=clock_timestamp() where operation_id=p_operation_id;
  return result;
end $$;

create function public.account_erasure_record_receipt(p_profile_id uuid)
returns table(operation_id uuid,intent jsonb,completion jsonb)
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Erasure worker required' using errcode='42501'; end if;
  return query select r.operation_id,r.intent,r.completion from private.account_erasure_records r
    where r.profile_id=p_profile_id and r.accepted_at is not null;
end $$;

create function public.complete_recorded_account_erasure(p_profile_id uuid,p_completion jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare receipt private.account_erasure_records%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Erasure worker required' using errcode='42501'; end if;
  select * into receipt from private.account_erasure_records where profile_id=p_profile_id for update;
  if not found or receipt.accepted_at is null then raise exception 'Acknowledged intent required' using errcode='23514'; end if;
  perform private.validate_erasure_record(p_completion,'complete',receipt.operation_id);
  if p_completion->>'profileToken' is distinct from receipt.intent->>'profileToken'
    or p_completion->>'authToken' is distinct from receipt.intent->>'authToken'
    or p_completion->>'keyVersion' is distinct from receipt.intent->>'keyVersion'
    or (p_completion->>'sequence')::bigint <= (receipt.intent->>'sequence')::bigint then
    raise exception 'Completion mismatch' using errcode='23514'; end if;
  if receipt.completed_at is not null then
    if receipt.completion is distinct from p_completion then raise exception 'Completion conflict' using errcode='23514'; end if;
    return;
  end if;
  perform public.erasure_auth_removed(p_profile_id);
  update private.account_erasure_records set completion=p_completion,completed_at=clock_timestamp(),auth_user_id=null
    where profile_id=p_profile_id;
end $$;

-- The original routine remains as the implementation called by trusted wrappers.
create function private.guard_recorded_erasure_job()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' or not exists(
    select 1 from private.account_erasure_records r where r.profile_id=new.profile_id
      and r.auth_user_id=new.auth_user_id and r.intent is not null) then
    raise exception 'Acknowledged independent intent required' using errcode='42501';
  end if;
  return new;
end $$;
create trigger account_erasure_record_guard before insert on private.account_erasure_jobs
  for each row execute function private.guard_recorded_erasure_job();
revoke all on function private.guard_recorded_erasure_job() from public,anon,authenticated,service_role;
revoke execute on function public.begin_account_erasure() from authenticated;
revoke execute on function public.erasure_auth_removed(uuid) from service_role;
revoke all on function private.validate_erasure_record(jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.reserve_account_erasure_record(uuid), public.begin_recorded_account_erasure(uuid,jsonb),
  public.account_erasure_record_receipt(uuid), public.complete_recorded_account_erasure(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.reserve_account_erasure_record(uuid), public.begin_recorded_account_erasure(uuid,jsonb),
  public.account_erasure_record_receipt(uuid), public.complete_recorded_account_erasure(uuid,jsonb) to service_role;
commit;
