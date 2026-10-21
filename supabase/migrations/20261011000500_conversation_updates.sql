-- Publish only access-controlled revision signals, never conversation content.
begin;
create table public.conversation_updates (
  group_id uuid primary key references public.groups(id) on delete restrict,
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.account_updates (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp()
);
revoke all on public.conversation_updates,public.account_updates from public,anon,authenticated,service_role;
alter table public.conversation_updates enable row level security;
alter table public.account_updates enable row level security;
create policy conversation_updates_member_read on public.conversation_updates for select to authenticated
  using(private.is_active_member(group_id));
create policy account_updates_own_read on public.account_updates for select to authenticated
  using(profile_id=private.current_profile_id());
grant select on public.conversation_updates,public.account_updates to authenticated;
create function private.bump_conversation(p_group_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.conversation_updates(group_id) values(p_group_id)
    on conflict(group_id) do update set revision=public.conversation_updates.revision+1,updated_at=clock_timestamp();
end $$;
create function private.bump_account(p_profile_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_profile_id is null then return; end if;
  insert into public.account_updates(profile_id) values(p_profile_id)
    on conflict(profile_id) do update set revision=public.account_updates.revision+1,updated_at=clock_timestamp();
end $$;
create function private.signal_conversation_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='groups' then perform private.bump_conversation(new.id);
  else perform private.bump_conversation(new.group_id); end if;
  if tg_table_name='group_memberships' then perform private.bump_account(new.user_id); end if;
  return new;
end $$;
create function private.signal_notification_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.bump_account(new.recipient_id);
  if tg_op='UPDATE' and old.recipient_id is distinct from new.recipient_id then perform private.bump_account(old.recipient_id); end if;
  return new;
end $$;
create function private.signal_username_change() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.bump_account(new.profile_id); return new; end $$;
create trigger timeline_signal_change after insert or update on public.timeline_entries
  for each row execute function private.signal_conversation_change();
create trigger replies_signal_change after insert or update on public.thread_replies
  for each row execute function private.signal_conversation_change();
create trigger memberships_signal_change after insert or update on public.group_memberships
  for each row execute function private.signal_conversation_change();
create trigger groups_signal_change after insert or update of name,availability on public.groups
  for each row execute function private.signal_conversation_change();
create trigger notifications_signal_change after insert or update on private.mention_notifications
  for each row execute function private.signal_notification_change();
create trigger usernames_signal_change after insert or update on private.profile_usernames
  for each row execute function private.signal_username_change();
revoke all on function private.bump_conversation(uuid),private.bump_account(uuid),private.signal_conversation_change(),private.signal_notification_change(),private.signal_username_change() from public,anon,authenticated,service_role;
insert into public.conversation_updates(group_id) select id from public.groups where availability='available';
insert into public.account_updates(profile_id) select id from public.profiles where state='active';
alter publication supabase_realtime add table public.conversation_updates,public.account_updates;
commit;
