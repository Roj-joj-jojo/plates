-- Candidate only. Review and test before separately approved local application.
-- Ordinary removal blanks originals, retains structure/replies and Menu snapshots.
begin;
do $$ begin
  if current_user <> 'postgres' then raise exception 'Run with the local migration role postgres'; end if;
end $$;

alter table public.plates add column edited_at timestamptz;
alter table public.timeline_entries add column edited_at timestamptz;
alter table public.thread_replies add column edited_at timestamptz;
grant select (edited_at) on public.plates, public.timeline_entries, public.thread_replies to authenticated;
create or replace view public.timeline_content with (security_invoker=true) as
  select id,group_id,author_id,kind,body,links,position,availability,created_at,updated_at,edited_at
  from public.timeline_entries;
create or replace view public.reply_content with (security_invoker=true) as
  select id,thread_id,group_id,author_id,body,links,position,availability,created_at,updated_at,edited_at
  from public.thread_replies;

create function private.mark_content_edited() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.availability='available' and row(new.body,new.links) is distinct from row(old.body,old.links) then
    new.edited_at:=clock_timestamp();
  end if;
  return new;
end $$;
create trigger entries_edited before update on public.timeline_entries for each row execute function private.mark_content_edited();
create trigger replies_edited before update on public.thread_replies for each row execute function private.mark_content_edited();
create trigger plates_edited before update on public.plates for each row execute function private.mark_content_edited();
revoke all on function private.mark_content_edited() from public,anon,authenticated,service_role;

-- Preserve the account-erasure exception while enabling guarded Request edits.
create or replace function private.guard_request_erasure() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.entry_id is distinct from old.entry_id or new.kind is distinct from old.kind
    or new.created_at is distinct from old.created_at then
    raise exception 'Request identity is immutable' using errcode='23514';
  end if;
  if new.question is distinct from old.question and not (
    (new.question='' and current_setting('plates.erasure_profile',true) is not null
      and exists(select 1 from public.timeline_entries e where e.id=new.entry_id and e.availability='erased'))
    or (current_setting('plates.content_entry',true)=new.entry_id::text
      and exists(select 1 from public.timeline_entries e where e.id=new.entry_id
        and (e.availability='available' or (e.availability='removed' and new.question='Request removed.'))))) then
    raise exception 'Request question requires its guarded content action' using errcode='23514';
  end if;
  return new;
end $$;

create function public.content_control_access(p_group_id uuid default null)
returns table(profile_id uuid,can_moderate boolean)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  if actor is null or (p_group_id is not null and not private.is_active_member(p_group_id)) then
    raise exception 'Active membership required' using errcode='42501'; end if;
  return query select actor, p_group_id is not null and exists(select 1 from public.group_memberships m
    where m.group_id=p_group_id and m.user_id=actor and m.state='active' and m.role='owner');
end $$;

create function public.edit_table_content(p_entry_id uuid,p_expected_updated_at timestamptz,
  p_body text,p_links jsonb default '[]',p_question text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_content_actor(); entry public.timeline_entries%rowtype; group_key uuid;
  prior_question text; prior_marker text:=current_setting('plates.content_entry',true);
begin
  select group_id into group_key from public.timeline_entries where id=p_entry_id;
  perform 1 from public.groups where id=group_key and availability='available' for update;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode='42501'; end if;
  select * into entry from public.timeline_entries where id=p_entry_id and group_id=group_key
    and author_id=actor and availability='available' for update;
  if not found then raise exception 'Only the author can edit available content' using errcode='42501'; end if;
  if entry.updated_at is distinct from p_expected_updated_at then
    raise exception 'Content changed; refresh before editing' using errcode='40001'; end if;
  perform private.validate_m2_input(p_body,p_links,'{}',true);
  if entry.kind='request' then
    if p_question is null or char_length(p_question) not between 1 and 500
      or p_question !~ '[^[:space:]]' or p_question ~ '[[:cntrl:]]' then
      raise exception 'A question of 1–500 characters is required' using errcode='23514'; end if;
    select question into prior_question from public.requests where entry_id=p_entry_id for update;
    perform set_config('plates.content_entry',p_entry_id::text,true);
    update public.requests set question=p_question where entry_id=p_entry_id;
    perform set_config('plates.content_entry',coalesce(prior_marker,''),true);
  elsif p_question is not null then
    raise exception 'Only Requests have a question' using errcode='23514';
  end if;
  update public.timeline_entries set body=p_body,links=p_links,
    edited_at=case when prior_question is distinct from p_question then clock_timestamp() else edited_at end
    where id=p_entry_id;
  return p_entry_id;
end $$;

create function public.edit_table_reply(p_reply_id uuid,p_expected_updated_at timestamptz,
  p_body text,p_links jsonb default '[]') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_content_actor(); reply public.thread_replies%rowtype; group_key uuid; thread_key uuid;
begin
  select group_id,thread_id into group_key,thread_key from public.thread_replies where id=p_reply_id;
  perform 1 from public.groups where id=group_key and availability='available' for share;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode='42501'; end if;
  perform 1 from public.threads where id=thread_key and group_id=group_key for update;
  select * into reply from public.thread_replies where id=p_reply_id and group_id=group_key
    and author_id=actor and availability='available' for update;
  if not found then raise exception 'Only the author can edit an available reply' using errcode='42501'; end if;
  if reply.updated_at is distinct from p_expected_updated_at then
    raise exception 'Reply changed; refresh before editing' using errcode='40001'; end if;
  perform private.validate_m2_input(p_body,p_links,'{}',true);
  update public.thread_replies set body=p_body,links=p_links where id=p_reply_id;
  return p_reply_id;
end $$;

create function public.remove_table_content(p_entry_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_content_actor(); entry public.timeline_entries%rowtype; group_key uuid;
  prior_marker text:=current_setting('plates.content_entry',true);
begin
  select group_id into group_key from public.timeline_entries where id=p_entry_id;
  perform 1 from public.groups where id=group_key and availability='available' for update;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode='42501'; end if;
  select * into entry from public.timeline_entries where id=p_entry_id and group_id=group_key for update;
  if not found or (entry.author_id is distinct from actor and not exists(select 1 from public.group_memberships
    where group_id=group_key and user_id=actor and role='owner' and state='active')) then
    raise exception 'Only the author or a Table Admin can remove content' using errcode='42501'; end if;
  if entry.availability='removed' then return; end if;
  if entry.availability<>'available' then raise exception 'Content unavailable' using errcode='42501'; end if;
  if entry.updated_at is distinct from p_expected_updated_at then
    raise exception 'Content changed; refresh before removing' using errcode='40001'; end if;
  update public.timeline_entries set availability='removed',body='',links='[]' where id=p_entry_id;
  if entry.kind='request' then
    perform set_config('plates.content_entry',p_entry_id::text,true);
    update public.requests set question='Request removed.' where entry_id=p_entry_id;
    perform set_config('plates.content_entry',coalesce(prior_marker,''),true);
  end if;
end $$;

create function public.remove_table_reply(p_reply_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_content_actor(); reply public.thread_replies%rowtype; group_key uuid; thread_key uuid;
begin
  select group_id,thread_id into group_key,thread_key from public.thread_replies where id=p_reply_id;
  perform 1 from public.groups where id=group_key and availability='available' for update;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode='42501'; end if;
  perform 1 from public.threads where id=thread_key and group_id=group_key for update;
  select * into reply from public.thread_replies where id=p_reply_id and group_id=group_key for update;
  if not found or (reply.author_id is distinct from actor and not exists(select 1 from public.group_memberships
    where group_id=group_key and user_id=actor and role='owner' and state='active')) then
    raise exception 'Only the author or a Table Admin can remove a reply' using errcode='42501'; end if;
  if reply.availability='removed' then return; end if;
  if reply.availability<>'available' then raise exception 'Reply unavailable' using errcode='42501'; end if;
  if reply.updated_at is distinct from p_expected_updated_at then
    raise exception 'Reply changed; refresh before removing' using errcode='40001'; end if;
  update public.thread_replies set availability='removed',body='',links='[]' where id=p_reply_id;
end $$;

create function public.unpublish_plate(p_plate_id uuid,p_expected_revision bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_content_actor(); plate public.plates%rowtype;
begin
  select * into plate from public.plates where id=p_plate_id and author_id=actor for update;
  if not found then raise exception 'Only the author can unpublish this Plate' using errcode='42501'; end if;
  if plate.availability='removed' then return; end if;
  if plate.availability<>'available' then raise exception 'Plate unavailable' using errcode='42501'; end if;
  if plate.revision is distinct from p_expected_revision then
    raise exception 'Plate changed; refresh before unpublishing' using errcode='40001'; end if;
  update public.plates set availability='removed',body='',links='[]',tags='[]' where id=p_plate_id;
end $$;

-- Shared Plate changes refresh relevant Tables and saved-source status.
create function private.signal_plate_content_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  for target in select distinct e.group_id from public.plate_shares s
    join public.timeline_entries e on e.id=s.entry_id where s.plate_id=new.id loop
    perform private.bump_conversation(target);
  end loop;
  for target in select distinct saver_id from public.menu_plate_saves where plate_id=new.id loop
    perform private.bump_account(target);
  end loop;
  return new;
end $$;
create trigger plate_content_signal after update on public.plates for each row execute function private.signal_plate_content_change();
revoke all on function private.signal_plate_content_change() from public,anon,authenticated,service_role;

-- Available replies retain their notification context after root removal.
create or replace function public.my_mention_notifications()
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
    and (entry.availability='available' or (reply.availability='available' and root.availability in ('available','removed')))
  order by n.created_at desc,n.id limit 100;
$$;

revoke all on function public.content_control_access(uuid),public.edit_table_content(uuid,timestamptz,text,jsonb,text),
  public.edit_table_reply(uuid,timestamptz,text,jsonb),public.remove_table_content(uuid,timestamptz),
  public.remove_table_reply(uuid,timestamptz),public.unpublish_plate(uuid,bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.content_control_access(uuid),public.edit_table_content(uuid,timestamptz,text,jsonb,text),
  public.edit_table_reply(uuid,timestamptz,text,jsonb),public.remove_table_content(uuid,timestamptz),
  public.remove_table_reply(uuid,timestamptz),public.unpublish_plate(uuid,bigint) to authenticated;
commit;
