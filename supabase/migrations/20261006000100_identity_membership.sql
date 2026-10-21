-- M1: identity and Table membership. Local application requires owner approval.
-- Additive migration: no existing records are backfilled, removed or replaced.
begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Run M1 with the local migration role postgres';
  end if;
  if exists (select 1 from auth.users) then
    raise exception 'M1 requires an empty Auth user table; review existing users before migration';
  end if;
end;
$$;

create schema private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  state text not null default 'active'
    check (state in ('active', 'disabled', 'erased')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint profiles_name_valid check (
    (state = 'erased' and display_name is null)
    or (state <> 'erased' and display_name is not null
      and char_length(display_name) between 1 and 80
      and display_name !~ '^[[:space:]]|[[:space:]]$'
      and display_name !~ '[[:cntrl:]]')
  )
);

create table private.profile_auth_links (
  profile_id uuid primary key references public.profiles(id)
    on update restrict on delete restrict,
  auth_user_id uuid not null unique references auth.users(id)
    on update restrict on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_by uuid references public.profiles(id) on update restrict on delete restrict,
  availability text not null default 'available'
    check (availability in ('available', 'removed', 'erased')),
  next_entry_position bigint not null default 1 check (next_entry_position > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint groups_content_valid check (
    (availability = 'erased' and name is null and created_by is null)
    or (availability <> 'erased' and name is not null
      and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]')
  ),
  constraint available_group_has_creator check (
    availability <> 'available' or created_by is not null
  )
);

create table public.group_memberships (
  group_id uuid not null references public.groups(id) on update restrict on delete restrict,
  user_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  role text not null check (role in ('owner', 'member')),
  state text not null check (state in ('active', 'left', 'removed')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (group_id, user_id)
);
create index group_memberships_by_user on public.group_memberships(user_id, group_id);

create table public.membership_periods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('left', 'removed', 'erased')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (group_id, user_id) references public.group_memberships(group_id, user_id)
    on update restrict on delete restrict,
  constraint membership_period_bounds check (
    isfinite(joined_at) and (
      (ended_at is null and end_reason is null)
      or (ended_at is not null and isfinite(ended_at)
        and end_reason is not null and ended_at > joined_at)
    )
  )
);
create unique index membership_one_open_period
  on public.membership_periods(group_id, user_id) where ended_at is null;
create index membership_period_history
  on public.membership_periods(group_id, user_id, joined_at);

-- No public table-level SELECT: hidden columns cannot be recovered via SELECT *.
revoke all on public.profiles, public.groups, public.group_memberships,
  public.membership_periods, private.profile_auth_links
  from public, anon, authenticated, service_role;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.membership_periods enable row level security;
alter table private.profile_auth_links enable row level security;

-- Each definer is owned by postgres (checked above), which bypasses these tables'
-- RLS. Bodies are schema-qualified; no dynamic SQL or caller-selected user IDs.
create function private.current_profile_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.id from private.profile_auth_links l
  join public.profiles p on p.id = l.profile_id
  where l.auth_user_id = (select auth.uid()) and p.state = 'active';
$$;

create function private.is_active_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_memberships m
    join public.groups g on g.id = m.group_id
    where m.group_id = p_group_id and m.user_id = private.current_profile_id()
      and m.state = 'active' and g.availability = 'available'
  );
$$;

create function private.is_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_memberships m
    join public.groups g on g.id = m.group_id
    where m.group_id = p_group_id and m.user_id = private.current_profile_id()
      and m.state = 'active' and m.role = 'owner' and g.availability = 'available'
  );
$$;

create policy profiles_signed_in_read on public.profiles for select to authenticated
  using (state = 'active' and (select private.current_profile_id()) is not null);
create policy groups_member_read on public.groups for select to authenticated
  using (private.is_active_member(id));
create policy memberships_member_read on public.group_memberships for select to authenticated
  using (private.is_active_member(group_id));
create policy periods_subject_or_owner_read on public.membership_periods
  for select to authenticated using (
    user_id = (select private.current_profile_id()) or private.is_group_owner(group_id)
  );

grant select (id, display_name, created_at, updated_at) on public.profiles to authenticated;
grant select (id, name, created_by, availability, created_at, updated_at)
  on public.groups to authenticated;
grant select (group_id, user_id, role, state, created_at, updated_at)
  on public.group_memberships to authenticated;
grant select (id, group_id, user_id, joined_at, ended_at, end_reason, created_at, updated_at)
  on public.membership_periods to authenticated;

create view public.profile_directory with (security_invoker = true) as
  select id, display_name, created_at, updated_at from public.profiles;
revoke all on public.profile_directory from public, anon, authenticated, service_role;
grant select on public.profile_directory to authenticated;

-- Immutable keys also prevent trigger checks from validating only a new parent.
create function private.guard_record_update()
returns trigger language plpgsql set search_path = '' as $$
declare field_name text;
begin
  foreach field_name in array tg_argv loop
    if (to_jsonb(new) -> field_name) is distinct from (to_jsonb(old) -> field_name) then
      raise exception 'Immutable field: %', field_name using errcode = '23514';
    end if;
  end loop;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger profiles_immutable before update on public.profiles for each row
  execute function private.guard_record_update('id', 'created_at');
create trigger auth_links_immutable before update on private.profile_auth_links for each row
  execute function private.guard_record_update('profile_id', 'auth_user_id', 'created_at');
create trigger groups_immutable before update on public.groups for each row
  execute function private.guard_record_update('id', 'created_at');
create trigger memberships_immutable before update on public.group_memberships for each row
  execute function private.guard_record_update('group_id', 'user_id', 'created_at');
create trigger periods_immutable before update on public.membership_periods for each row
  execute function private.guard_record_update('id', 'group_id', 'user_id', 'joined_at', 'created_at');

create function private.guard_period_close()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.ended_at is not null and
     (new.ended_at is distinct from old.ended_at or new.end_reason is distinct from old.end_reason) then
    raise exception 'Closed membership periods cannot be rewritten' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger periods_close_once before update on public.membership_periods for each row
  execute function private.guard_period_close();

-- All future transition functions must lock profiles in ID order, then group
-- FOR UPDATE before membership/period DML. This trigger is a second guard for
-- privileged fixture writes; it is not a substitute for that full lock order.
create function private.guard_membership_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.groups where id = new.group_id for update;
  return new;
end;
$$;
create trigger memberships_parent_guard before insert or update on public.group_memberships
  for each row execute function private.guard_membership_parent();
create trigger periods_parent_guard before insert or update on public.membership_periods
  for each row execute function private.guard_membership_parent();

create function private.guard_auth_link_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = new.profile_id for update;
  return new;
end;
$$;
create trigger auth_links_parent_guard before insert or update on private.profile_auth_links
  for each row execute function private.guard_auth_link_parent();

create function private.check_profile_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_key uuid; profile_state text; link_count integer;
begin
  if tg_table_name = 'profiles' then profile_key := new.id;
  else profile_key := new.profile_id;
  end if;
  select state into profile_state from public.profiles where id = profile_key;
  select count(*) into link_count from private.profile_auth_links where profile_id = profile_key;
  if (profile_state = 'active' and link_count <> 1)
     or (profile_state = 'erased' and link_count <> 0) then
    raise exception 'Profile state and private Auth link disagree' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger profiles_identity_consistent after insert or update on public.profiles
  deferrable initially deferred for each row execute function private.check_profile_identity();
create constraint trigger auth_links_identity_consistent after insert or update on private.profile_auth_links
  deferrable initially deferred for each row execute function private.check_profile_identity();

create function private.check_membership_periods()
returns trigger language plpgsql security definer set search_path = '' as $$
declare member_state text; open_count integer;
begin
  select state into member_state from public.group_memberships
    where group_id = new.group_id and user_id = new.user_id;
  select count(*) into open_count from public.membership_periods
    where group_id = new.group_id and user_id = new.user_id and ended_at is null;
  if (member_state = 'active' and open_count <> 1)
     or (member_state in ('left', 'removed') and open_count <> 0) then
    raise exception 'Membership state and open periods disagree' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.membership_periods a join public.membership_periods b
      on a.group_id = b.group_id and a.user_id = b.user_id and a.id < b.id
    where a.group_id = new.group_id and a.user_id = new.user_id
      and a.joined_at < coalesce(b.ended_at, 'infinity'::timestamptz)
      and b.joined_at < coalesce(a.ended_at, 'infinity'::timestamptz)
  ) then
    raise exception 'Membership periods overlap' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger memberships_periods_consistent after insert or update on public.group_memberships
  deferrable initially deferred for each row execute function private.check_membership_periods();
create constraint trigger periods_membership_consistent after insert or update on public.membership_periods
  deferrable initially deferred for each row execute function private.check_membership_periods();

create function private.check_group_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare group_key uuid;
begin
  if tg_table_name = 'groups' then group_key := new.id;
  else group_key := new.group_id;
  end if;
  if exists (select 1 from public.groups where id = group_key and availability = 'available')
     and not exists (select 1 from public.group_memberships
       where group_id = group_key and role = 'owner' and state = 'active') then
    raise exception 'An available Table must retain an active owner' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger groups_have_owner after insert or update on public.groups
  deferrable initially deferred for each row execute function private.check_group_owner();
create constraint trigger memberships_preserve_owner after insert or update on public.group_memberships
  deferrable initially deferred for each row execute function private.check_group_owner();

-- No hard-delete lifecycle is enabled in M1, even through incidental admin DML.
-- A future reviewed migration must define erasure and its guards first.
create function private.reject_structural_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Hard deletion is not enabled for M1 records' using errcode = '23514';
end;
$$;
create trigger profiles_no_delete before delete on public.profiles for each row
  execute function private.reject_structural_delete();
create trigger auth_links_no_delete before delete on private.profile_auth_links for each row
  execute function private.reject_structural_delete();
create trigger groups_no_delete before delete on public.groups for each row
  execute function private.reject_structural_delete();
create trigger memberships_no_delete before delete on public.group_memberships for each row
  execute function private.reject_structural_delete();
create trigger periods_no_delete before delete on public.membership_periods for each row
  execute function private.reject_structural_delete();

create function private.handle_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_key uuid; profile_name text;
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'display_name') is distinct from 'string' then
    raise exception 'Signup requires a display_name string' using errcode = '23514';
  end if;
  profile_name := regexp_replace(new.raw_user_meta_data ->> 'display_name',
    '^[[:space:]]+|[[:space:]]+$', '', 'g');
  insert into public.profiles(display_name) values (profile_name) returning id into profile_key;
  insert into private.profile_auth_links(profile_id, auth_user_id) values (profile_key, new.id);
  return new;
end;
$$;
create trigger plates_profile_after_signup after insert on auth.users
  for each row execute function private.handle_auth_user_created();

create function public.update_display_name(p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_key uuid;
begin
  profile_key := private.current_profile_id();
  if profile_key is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = profile_key and state = 'active' for update;
  if not found then raise exception 'Active profile required' using errcode = '42501'; end if;
  update public.profiles set display_name = regexp_replace(p_display_name,
    '^[[:space:]]+|[[:space:]]+$', '', 'g') where id = profile_key;
end;
$$;

create function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare profile_key uuid; group_key uuid;
begin
  profile_key := private.current_profile_id();
  if profile_key is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = profile_key and state = 'active' for share;
  if not found then raise exception 'Active profile required' using errcode = '42501'; end if;
  insert into public.groups(name, created_by)
    values (regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'), profile_key)
    returning id into group_key;
  insert into public.group_memberships(group_id, user_id, role, state)
    values (group_key, profile_key, 'owner', 'active');
  insert into public.membership_periods(group_id, user_id) values (group_key, profile_key);
  return group_key;
end;
$$;

-- Private is new and dedicated to this application; future functions must also
-- opt in to client execution explicitly. Trigger entry points are not callable.
revoke all on all functions in schema private from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;
grant execute on function private.current_profile_id(), private.is_active_member(uuid),
  private.is_group_owner(uuid) to authenticated;
revoke all on function public.create_group(text), public.update_display_name(text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_group(text), public.update_display_name(text)
  to authenticated;

commit;
