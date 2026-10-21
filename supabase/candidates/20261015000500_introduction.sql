-- Candidate only. Persistent local activation requires separate owner approval.
begin;
create table private.introduction_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  dismissed_at timestamptz,
  check ((profile_id is null and dismissed_at is null)
    or (profile_id is not null and dismissed_at is not null))
);
alter table private.introduction_preferences enable row level security;
revoke all on private.introduction_preferences from public,anon,authenticated,service_role;

create function public.my_introduction_completed() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  if actor is null then raise exception 'Active account required' using errcode='42501'; end if;
  return exists(select 1 from private.introduction_preferences where profile_id=actor);
end $$;

create function public.complete_introduction() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  -- Serialize completion with account cutoff, then recheck the current identity.
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found or actor is null or private.current_profile_id() is distinct from actor then
    raise exception 'Active account required' using errcode='42501';
  end if;
  insert into private.introduction_preferences(profile_id,dismissed_at) values(actor,clock_timestamp())
    on conflict(profile_id) do nothing;
end $$;

create function private.clear_introduction_on_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Recorded erasure begins with a disabled profile and an existing erasure job.
  -- An ordinary temporary disable preserves the account's introduction choice.
  if new.state='erased' or (new.state<>'active' and exists(
    select 1 from private.account_erasure_jobs where profile_id=new.id)) then
    update private.introduction_preferences set profile_id=null,dismissed_at=null where profile_id=new.id;
  end if;
  return new;
end $$;
create trigger profiles_clear_introduction after update of state on public.profiles
  for each row execute function private.clear_introduction_on_erasure();
revoke all on function public.my_introduction_completed(),public.complete_introduction(),
  private.clear_introduction_on_erasure() from public,anon,authenticated,service_role;
grant execute on function public.my_introduction_completed(),public.complete_introduction() to authenticated;
commit;
