-- Fixed, case-preserving usernames and Table-scoped account-linked mentions.
begin;
create table private.profile_usernames (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  username text check(username is null or username ~ '^[A-Za-z][A-Za-z0-9_]{2,29}$')
);
create unique index profile_usernames_case_unique on private.profile_usernames(lower(username)) where username is not null;
create table private.mention_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete restrict,
  sender_id uuid references public.profiles(id) on delete restrict,
  group_id uuid not null references public.groups(id) on delete restrict,
  entry_id uuid references public.timeline_entries(id) on delete restrict,
  reply_id uuid references public.thread_replies(id) on delete restrict,
  active boolean not null default true,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check((entry_id is null)<>(reply_id is null))
);
create unique index mention_entry_once on private.mention_notifications(entry_id,recipient_id) where entry_id is not null;
create unique index mention_reply_once on private.mention_notifications(reply_id,recipient_id) where reply_id is not null;
revoke all on private.profile_usernames,private.mention_notifications from public,anon,authenticated,service_role;

create function public.my_username() returns text language sql stable security definer set search_path='' as $$
  select username from private.profile_usernames where profile_id=private.current_profile_id();
$$;
create function public.choose_username(p_username text) returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); existing text;
begin
  perform 1 from public.profiles where id=actor and state='active' for update;
  if not found then raise exception 'Active account required' using errcode='42501'; end if;
  if p_username is null or p_username !~ '^[A-Za-z][A-Za-z0-9_]{2,29}$'
    or lower(p_username) in ('formermember','admin','system','support') then
    raise exception 'Choose 3–30 letters, numbers or underscores, starting with a letter' using errcode='23514'; end if;
  select username into existing from private.profile_usernames where profile_id=actor;
  if existing is not null then
    if existing=p_username then return existing; end if;
    raise exception 'Username already chosen' using errcode='23514'; end if;
  insert into private.profile_usernames(profile_id,username) values(actor,p_username)
    on conflict(profile_id) do update set username=excluded.username;
  return p_username;
end $$;

create function public.table_mention_members(p_group_id uuid)
returns table(profile_id uuid,username text,display_name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_member(p_group_id) then raise exception 'Table membership required' using errcode='42501'; end if;
  return query select p.id,u.username,p.display_name from public.group_memberships m
    join public.profiles p on p.id=m.user_id join private.profile_usernames u on u.profile_id=p.id
    where m.group_id=p_group_id and m.state='active' and p.state='active' and u.username is not null order by lower(u.username);
end $$;

create function public.resolve_mentions(p_ids uuid[])
returns table(profile_id uuid,username text,display_name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_profile_id() is null or cardinality(p_ids)>100 then raise exception 'Active account required' using errcode='42501'; end if;
  return query select p.id,u.username,p.display_name from public.profiles p
    join private.profile_usernames u on u.profile_id=p.id where p.id=any(p_ids) and u.username is not null
    and p.state='active' and private.can_read_profile(p.id);
end $$;

create function private.normalise_content_mentions()
returns trigger language plpgsql security definer set search_path='' as $$
declare matched text[]; target uuid; actor uuid:=private.current_profile_id();
begin
  if new.availability<>'available' or new.body='' then return new; end if;
  -- Only content written by the current active author can create new mentions.
  if new.author_id is distinct from actor then return new; end if;
  for matched in select regexp_matches(new.body,'(^|[^A-Za-z0-9_@])@([A-Za-z][A-Za-z0-9_]{2,29})(?![A-Za-z0-9_])','g') loop
    select u.profile_id into target from private.profile_usernames u
      join public.group_memberships m on m.user_id=u.profile_id
      join public.profiles p on p.id=u.profile_id
      where lower(u.username)=lower(matched[2]) and m.group_id=new.group_id and m.state='active' and p.state='active';
    if target is not null then new.body:=regexp_replace(new.body,
      '(^|[^A-Za-z0-9_@])@'||matched[2]||'(?![A-Za-z0-9_])','\1@['||target::text||']','gi'); end if;
  end loop;
  for matched in select regexp_matches(new.body,'@\[([0-9a-f-]{36})\]','g') loop
    target:=matched[1]::uuid;
    if not exists(select 1 from public.group_memberships m join public.profiles p on p.id=m.user_id
      join private.profile_usernames u on u.profile_id=p.id where m.group_id=new.group_id and m.user_id=target
      and m.state='active' and p.state='active' and u.username is not null) then
      raise exception 'Mention someone currently in this Table' using errcode='23514'; end if;
  end loop;
  if char_length(new.body)>20000 then raise exception 'Message is too long with mentions' using errcode='23514'; end if;
  return new;
end $$;

create function private.record_content_mentions()
returns trigger language plpgsql security definer set search_path='' as $$
declare matched text[]; target uuid; is_reply boolean:=tg_table_name='thread_replies';
begin
  if tg_op='UPDATE' then
    update private.mention_notifications set active=false where
      (is_reply and reply_id=new.id) or (not is_reply and entry_id=new.id);
  end if;
  if new.availability<>'available' or new.author_id is null then return new; end if;
  for matched in select regexp_matches(new.body,'@\[([0-9a-f-]{36})\]','g') loop
    target:=matched[1]::uuid;
    if target=new.author_id then continue; end if;
    if not exists(select 1 from public.profiles where id=target and state='active') then continue; end if;
    if is_reply then
      insert into private.mention_notifications(recipient_id,sender_id,group_id,reply_id)
        values(target,new.author_id,new.group_id,new.id)
        on conflict(reply_id,recipient_id) where reply_id is not null do update set active=true;
    else
      insert into private.mention_notifications(recipient_id,sender_id,group_id,entry_id)
        values(target,new.author_id,new.group_id,new.id)
        on conflict(entry_id,recipient_id) where entry_id is not null do update set active=true;
    end if;
  end loop;
  return new;
end $$;
create trigger timeline_normalise_mentions before insert or update of body on public.timeline_entries
  for each row execute function private.normalise_content_mentions();
create trigger replies_normalise_mentions before insert or update of body on public.thread_replies
  for each row execute function private.normalise_content_mentions();
create trigger timeline_record_mentions after insert or update of body,availability on public.timeline_entries
  for each row execute function private.record_content_mentions();
create trigger replies_record_mentions after insert or update of body,availability on public.thread_replies
  for each row execute function private.record_content_mentions();

create function private.clear_erased_username_mentions()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state in ('disabled','erased') then
    update private.profile_usernames set username=null where profile_id=new.id;
    update private.mention_notifications set active=false,recipient_id=null,read_at=null where recipient_id=new.id;
    update private.mention_notifications set active=false,sender_id=null where sender_id=new.id;
  end if;
  return new;
end $$;
create trigger profiles_clear_username_mentions after update of state on public.profiles
  for each row execute function private.clear_erased_username_mentions();

create function public.my_mention_notifications()
returns table(id uuid,sender_name text,sender_username text,table_name text,url text,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,p.display_name,u.username,g.name,
    case when n.reply_id is not null then '/tables/'||g.id||case when root.kind='request' then '/requests/' else '/discussion/' end||root.id||'#reply-'||n.reply_id
      when entry.kind='message' then '/tables/'||g.id||'/messages/'||entry.id
      else '/tables/'||g.id||case when entry.kind='request' then '/requests/' else '/discussion/' end||entry.id end,
    n.read_at,n.created_at
  from private.mention_notifications n join public.profiles p on p.id=n.sender_id and p.state='active'
    left join private.profile_usernames u on u.profile_id=p.id join public.groups g on g.id=n.group_id
    left join public.timeline_entries entry on entry.id=n.entry_id
    left join public.thread_replies reply on reply.id=n.reply_id
    left join public.threads t on t.id=reply.thread_id left join public.timeline_entries root on root.id=t.root_entry_id
  where n.recipient_id=private.current_profile_id() and n.active and private.is_active_member(n.group_id)
    and (entry.availability='available' or (reply.availability='available' and root.availability='available'))
  order by n.created_at desc,n.id limit 100;
$$;
create function public.read_mention_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update private.mention_notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_id and recipient_id=private.current_profile_id() and active and private.is_active_member(group_id);
end $$;
revoke all on function private.normalise_content_mentions(),private.record_content_mentions(),private.clear_erased_username_mentions()
  from public,anon,authenticated,service_role;
revoke all on function public.my_username(),public.choose_username(text),public.table_mention_members(uuid),public.resolve_mentions(uuid[]),public.my_mention_notifications(),public.read_mention_notification(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.my_username(),public.choose_username(text),public.table_mention_members(uuid),public.resolve_mentions(uuid[]),public.my_mention_notifications(),public.read_mention_notification(uuid) to authenticated;
commit;
