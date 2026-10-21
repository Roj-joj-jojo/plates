-- Owner-managed app admission. Table roles and subscriptions remain separate.
-- Prepare disabled; explicit owner setup activates the guard after review.
begin;
create table private.app_admission_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  owner_profile_id uuid references public.profiles(id) on delete restrict on update restrict
);
insert into private.app_admission_settings(singleton) values(true);
create table private.signup_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  allowed boolean not null default true,
  consumed_auth_id uuid,
  created_by uuid references public.profiles(id) on delete restrict on update restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check(email is null or (email=lower(btrim(email)) and char_length(email) between 3 and 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  check(not allowed or email is not null),
  check(consumed_auth_id is null or (not allowed and email is null))
);
revoke all on private.app_admission_settings,private.signup_allowlist from public,anon,authenticated,service_role;

create function private.is_app_access_owner()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.app_admission_settings s
    where s.owner_profile_id=private.current_profile_id());
$$;
revoke all on function private.is_app_access_owner() from public,anon,authenticated,service_role;

create function public.app_access_status()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('enabled',coalesce((select enabled from private.app_admission_settings where singleton),true),
    'can_manage',private.is_app_access_owner());
$$;

create function public.list_signup_allowlist()
returns table(id uuid,email text,allowed boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_app_access_owner() then raise exception 'App owner required' using errcode='42501'; end if;
  return query select a.id,a.email,a.allowed,a.created_at from private.signup_allowlist a
    where a.email is not null order by a.created_at desc,a.id;
end $$;

create function public.allow_signup_email(p_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); address text:=lower(btrim(p_email)); result uuid;
begin
  -- Use the same profile-before-settings lock order as erasure and activation.
  perform 1 from public.profiles where id=actor and state='active' for share;
  perform 1 from private.app_admission_settings where singleton for update;
  if not private.is_app_access_owner() then raise exception 'App owner required' using errcode='42501'; end if;
  if address is null or char_length(address) not between 3 and 254
    or address !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Valid email required' using errcode='23514'; end if;
  if exists(select 1 from auth.users where lower(email)=address) then
    raise exception 'This address already has an account' using errcode='23514'; end if;
  insert into private.signup_allowlist(email,created_by) values(address,actor)
    on conflict(email) do update set allowed=true,updated_at=clock_timestamp()
    returning id into result;
  return result;
end $$;

create function public.withdraw_signup_email(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  perform 1 from public.profiles where id=actor and state='active' for share;
  perform 1 from private.app_admission_settings where singleton for update;
  if not private.is_app_access_owner() then raise exception 'App owner required' using errcode='42501'; end if;
  update private.signup_allowlist set allowed=false,updated_at=clock_timestamp()
    where id=p_id and email is not null;
end $$;

create function private.guard_allowlisted_signup()
returns trigger language plpgsql security definer set search_path='' as $$
declare admission uuid; enabled_guard boolean;
begin
  select enabled into enabled_guard from private.app_admission_settings where singleton for share;
  if enabled_guard is distinct from false then
    select id into admission from private.signup_allowlist
      where email=lower(btrim(new.email)) and allowed for update;
    if admission is null then raise exception 'Signup is by invitation' using errcode='42501'; end if;
    update private.signup_allowlist set allowed=false,email=null,consumed_auth_id=new.id,
      updated_at=clock_timestamp() where id=admission;
  end if;
  return new;
end $$;
create trigger plates_allowlisted_signup before insert on auth.users
  for each row execute function private.guard_allowlisted_signup();
revoke all on function private.guard_allowlisted_signup() from public,anon,authenticated,service_role;

-- Consume email at account creation. Clear the remaining private identity on cutoff.
create function private.clear_erased_app_admission()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.state='active' and new.state in ('disabled','erased') then
    perform 1 from private.app_admission_settings where singleton for update;
    update private.app_admission_settings set owner_profile_id=null where owner_profile_id=new.id;
    update private.signup_allowlist set consumed_auth_id=null,updated_at=clock_timestamp()
      where consumed_auth_id in (select auth_user_id from private.profile_auth_links where profile_id=new.id);
    update private.signup_allowlist set created_by=null where created_by=new.id;
  end if;
  return new;
end $$;
create trigger profiles_clear_app_admission after update of state on public.profiles
  for each row execute function private.clear_erased_app_admission();
revoke all on function private.clear_erased_app_admission() from public,anon,authenticated,service_role;

-- One-time trusted setup; existing active accounts are preserved, not backfilled.
create function public.activate_signup_allowlist(p_owner_profile_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare existing uuid; already_enabled boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Trusted setup required' using errcode='42501'; end if;
  perform 1 from public.profiles p join private.profile_auth_links l on l.profile_id=p.id
    join auth.users u on u.id=l.auth_user_id
    where p.id=p_owner_profile_id and p.state='active' and u.email_confirmed_at is not null for update of p;
  if not found then raise exception 'Verified active owner required' using errcode='23514'; end if;
  select owner_profile_id,enabled into existing,already_enabled from private.app_admission_settings where singleton for update;
  if not found then raise exception 'Admission settings missing' using errcode='23514'; end if;
  if existing is not null and existing<>p_owner_profile_id then raise exception 'Owner already configured' using errcode='23514'; end if;
  if already_enabled and existing is null then raise exception 'Owner recovery requires review' using errcode='23514'; end if;
  update private.app_admission_settings set owner_profile_id=p_owner_profile_id,enabled=true where singleton;
end $$;

revoke all on function public.app_access_status() from public,anon,authenticated,service_role;
grant execute on function public.app_access_status() to anon,authenticated;
revoke all on function public.list_signup_allowlist(),public.allow_signup_email(text),public.withdraw_signup_email(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.list_signup_allowlist(),public.allow_signup_email(text),public.withdraw_signup_email(uuid)
  to authenticated;
revoke all on function public.activate_signup_allowlist(uuid) from public,anon,authenticated,service_role;
grant execute on function public.activate_signup_allowlist(uuid) to service_role;
commit;
