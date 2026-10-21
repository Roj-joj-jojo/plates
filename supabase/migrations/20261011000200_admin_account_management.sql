-- Alpha account management for the separately appointed app owner.
begin;
create table private.account_activity (
  profile_id uuid primary key references public.profiles(id) on delete restrict on update restrict,
  last_active_at timestamptz
);
revoke all on private.account_activity from public,anon,authenticated,service_role;
create function public.record_account_activity()
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  if actor is null then raise exception 'Active account required' using errcode='42501'; end if;
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found then raise exception 'Active account required' using errcode='42501'; end if;
  insert into private.account_activity(profile_id,last_active_at) values(actor,clock_timestamp())
    on conflict(profile_id) do update set last_active_at=excluded.last_active_at
    where private.account_activity.last_active_at is null
      or private.account_activity.last_active_at<clock_timestamp()-interval '1 minute';
end $$;
create function private.clear_erased_account_activity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state in ('disabled','erased') then
    update private.account_activity set last_active_at=null where profile_id=new.id;
  end if;
  return new;
end $$;
create trigger profiles_clear_activity after update of state on public.profiles
  for each row execute function private.clear_erased_account_activity();

create function public.admin_live_accounts()
returns table(profile_id uuid,email text,display_name text,last_active_at timestamptz,
  last_sign_in_at timestamptz,state text,is_owner boolean,cleanup_state text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_app_access_owner() then raise exception 'App owner required' using errcode='42501'; end if;
  return query select p.id,u.email::text,p.display_name,a.last_active_at,u.last_sign_in_at,p.state,
    p.id=(select owner_profile_id from private.app_admission_settings where singleton),j.state
    from public.profiles p left join private.profile_auth_links l on l.profile_id=p.id
    left join private.account_erasure_jobs j on j.profile_id=p.id
    left join auth.users u on u.id=coalesce(l.auth_user_id,j.auth_user_id)
    left join private.account_activity a on a.profile_id=p.id
    where p.state='active' or (j.state is not null and j.state<>'complete')
    order by (p.state='active') desc,p.created_at desc,p.id;
end $$;

create function public.admin_account_deletion_scope(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved_sub text:=current_setting('request.jwt.claim.sub',true); target_auth uuid; address text; impact jsonb;
begin
  if not private.is_app_access_owner() or p_profile_id=private.current_profile_id() then
    raise exception 'App owner may erase another account only' using errcode='42501'; end if;
  select l.auth_user_id,u.email into target_auth,address from public.profiles p
    join private.profile_auth_links l on l.profile_id=p.id join auth.users u on u.id=l.auth_user_id
    where p.id=p_profile_id and p.state='active';
  if not found or address is null then raise exception 'Active target required' using errcode='23514'; end if;
  -- Reuse the established full preflight without broadening its public grants.
  perform set_config('request.jwt.claim.sub',target_auth::text,true);
  impact:=public.account_erasure_impact();
  perform set_config('request.jwt.claim.sub',coalesce(saved_sub,''),true);
  return jsonb_build_object('profile_id',p_profile_id,'email',address,'impact',impact);
end $$;

create function private.check_admin_erasure_actor(p_actor_auth_id uuid,p_target_profile_id uuid)
returns uuid language plpgsql set search_path='' as $$
declare actor uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Trusted admin server required' using errcode='42501'; end if;
  select profile_id into actor from private.profile_auth_links where auth_user_id=p_actor_auth_id;
  -- Shared profile locks in ID order serialize admin requests against either erasure.
  perform 1 from public.profiles where id in (actor,p_target_profile_id) order by id for update;
  if actor is null or actor=p_target_profile_id or not exists(
    select 1 from private.app_admission_settings s join public.profiles p on p.id=s.owner_profile_id
      where s.singleton and s.owner_profile_id=actor and p.state='active') then
    raise exception 'App owner may erase another account only' using errcode='42501'; end if;
  return actor;
end $$;

create function public.admin_account_cleanup_authorised(p_profile_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_app_access_owner() or p_profile_id=private.current_profile_id() then
    raise exception 'App owner required' using errcode='42501'; end if;
  return exists(select 1 from private.account_erasure_jobs where profile_id=p_profile_id and state<>'complete');
end $$;

create function public.reserve_admin_account_erasure(p_actor_auth_id uuid,p_profile_id uuid)
returns table(profile_id uuid,operation_id uuid,auth_user_id uuid)
language plpgsql security definer set search_path='' as $$
declare target_auth uuid;
begin
  perform private.check_admin_erasure_actor(p_actor_auth_id,p_profile_id);
  select l.auth_user_id into target_auth from private.profile_auth_links l join public.profiles p on p.id=l.profile_id
    where p.id=p_profile_id and p.state='active';
  if target_auth is null then raise exception 'Active target required' using errcode='23514'; end if;
  return query select r.profile_id,r.operation_id,target_auth from public.reserve_account_erasure_record(target_auth) r;
end $$;

create function public.begin_admin_recorded_erasure(p_actor_auth_id uuid,p_operation_id uuid,p_intent jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  select profile_id into target from private.account_erasure_records where operation_id=p_operation_id;
  perform private.check_admin_erasure_actor(p_actor_auth_id,target);
  if target is null then raise exception 'Reserved target required' using errcode='23514'; end if;
  return public.begin_recorded_account_erasure(p_operation_id,p_intent);
end $$;

create function public.erasure_claim_objects_for(p_profile_id uuid)
returns table(profile_id uuid,bucket_id text,object_path text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Worker required' using errcode='42501'; end if;
  return query with chosen as (
    select o.profile_id,o.bucket_id,o.object_path from private.account_erasure_objects o
      where o.profile_id=p_profile_id and (o.state='pending' or (o.state='processing'
        and o.updated_at<clock_timestamp()-interval '2 minutes'))
      order by o.updated_at limit 20 for update skip locked
  ) update private.account_erasure_objects o set state='processing',attempts=attempts+1,updated_at=clock_timestamp()
    from chosen c where o.profile_id=c.profile_id and o.bucket_id=c.bucket_id and o.object_path=c.object_path
    returning o.profile_id,o.bucket_id,o.object_path;
end $$;

revoke all on function private.clear_erased_account_activity(),private.check_admin_erasure_actor(uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.record_account_activity(),public.admin_live_accounts(),public.admin_account_deletion_scope(uuid),public.admin_account_cleanup_authorised(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.record_account_activity(),public.admin_live_accounts(),public.admin_account_deletion_scope(uuid),public.admin_account_cleanup_authorised(uuid) to authenticated;
revoke all on function public.reserve_admin_account_erasure(uuid,uuid),public.begin_admin_recorded_erasure(uuid,uuid,jsonb),
  public.erasure_claim_objects_for(uuid) from public,anon,authenticated,service_role;
grant execute on function public.reserve_admin_account_erasure(uuid,uuid),public.begin_admin_recorded_erasure(uuid,uuid,jsonb),
  public.erasure_claim_objects_for(uuid) to service_role;
commit;
