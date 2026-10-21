-- Candidate only: no permanent activation or historical message backfill.
begin;

create table private.follow_acceptance_notifications (
  id uuid primary key default gen_random_uuid(),
  edge_id uuid references private.follow_edges(id), edge_version bigint not null,
  recipient_id uuid references public.profiles(id), sender_id uuid references public.profiles(id),
  read_at timestamptz, created_at timestamptz not null default clock_timestamp(),
  unique(edge_id,edge_version),
  check((edge_id is null and recipient_id is null and sender_id is null) or (edge_id is not null and recipient_id is not null and sender_id is not null))
);
alter table private.follow_acceptance_notifications enable row level security;
revoke all on private.follow_acceptance_notifications from public,anon,authenticated,service_role;
create trigger follow_acceptance_no_delete before delete on private.follow_acceptance_notifications
  for each row execute function private.reject_m2_delete();

create function private.capture_follow_acceptance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state='erased' then
    update private.follow_acceptance_notifications set edge_id=null,recipient_id=null,sender_id=null where edge_id=new.id;
  elsif old.state='pending' and new.state='approved' then
    insert into private.follow_acceptance_notifications(edge_id,edge_version,recipient_id,sender_id)
      values(new.id,new.version,new.follower_id,new.author_id) on conflict(edge_id,edge_version) do nothing;
  end if;
  return new;
end $$;
create trigger follow_acceptance_capture after update on private.follow_edges
  for each row execute function private.capture_follow_acceptance();

create or replace function public.my_follow_notifications()
returns table(id uuid,kind text,sender_id uuid,sender_name text,sender_username text,edge_id uuid,
  edge_version bigint,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select all_notices.* from (
    select n.id,n.kind,p.id as sender_id,p.display_name as sender_name,u.username as sender_username,n.edge_id,
      f.version as edge_version,n.read_at,n.created_at
    from private.follow_notifications n join private.follow_edges f on f.id=n.edge_id and f.version=n.edge_version
      join public.profiles p on p.id=n.sender_id and p.state='active'
      join private.profile_usernames u on u.profile_id=p.id and u.username is not null
    where n.recipient_id=private.current_profile_id() and n.resolved_at is null
      and f.author_id=n.recipient_id and f.follower_id=n.sender_id
      and ((n.kind='follow_request' and f.state='pending') or (n.kind='new_follower' and f.state='approved'))
    union all
    select n.id,'follow_accepted',p.id,p.display_name,u.username,n.edge_id,f.version,n.read_at,n.created_at
    from private.follow_acceptance_notifications n join private.follow_edges f on f.id=n.edge_id and f.version=n.edge_version and f.state='approved'
      join public.profiles p on p.id=n.sender_id and p.state='active'
      join private.profile_usernames u on u.profile_id=p.id and u.username is not null
    where n.recipient_id=private.current_profile_id() and f.follower_id=n.recipient_id and f.author_id=n.sender_id
  ) all_notices order by (all_notices.kind='follow_request') desc,all_notices.created_at desc,all_notices.id desc limit 100;
$$;
create or replace function public.read_follow_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found then raise exception 'Active sign-in required' using errcode='42501'; end if;
  update private.follow_notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_id and recipient_id=actor and resolved_at is null;
  update private.follow_acceptance_notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id and recipient_id=actor;
  perform private.bump_account(actor);
end $$;

-- Immutable receipt identities: old pages can acknowledge old events, never a new one.
-- No copied body, name or image URL. Current membership and source state guard reads.
create table private.table_activity_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id), sender_id uuid references public.profiles(id),
  group_id uuid references public.groups(id), period_id uuid references public.membership_periods(id),
  entry_id uuid references public.timeline_entries(id), reply_id uuid references public.thread_replies(id),
  kind text not null check(kind in ('added','message','question','share','reply','mention')),
  source_version timestamptz, created_at timestamptz not null default clock_timestamp(), read_at timestamptz,
  active boolean not null default true,
  check(not active or (recipient_id is not null and sender_id is not null and group_id is not null and period_id is not null)),
  check(not active or ((kind='added' and entry_id is null and reply_id is null) or
    (kind<>'added' and (entry_id is not null)<>(reply_id is not null) and source_version is not null)))
);
create unique index table_activity_entry_once on private.table_activity_events(recipient_id,period_id,entry_id,kind,source_version) where entry_id is not null;
create unique index table_activity_reply_once on private.table_activity_events(recipient_id,period_id,reply_id,kind,source_version) where reply_id is not null;
create unique index table_activity_add_once on private.table_activity_events(period_id) where kind='added';
create index table_activity_recipient on private.table_activity_events(recipient_id,group_id,created_at desc) where active and read_at is null;
alter table private.table_activity_events enable row level security;
revoke all on private.table_activity_events from public,anon,authenticated,service_role;
create trigger table_activity_no_delete before delete on private.table_activity_events for each row execute function private.reject_m2_delete();

create function private.capture_table_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare target record; event_kind text; sender uuid; edited boolean:=false;
begin
  if tg_table_name='membership_periods' then
    sender:=private.current_profile_id();
    if sender is null or sender=new.user_id or new.ended_at is not null then return new; end if;
    insert into private.table_activity_events(recipient_id,sender_id,group_id,period_id,kind)
      values(new.user_id,sender,new.group_id,new.id,'added') on conflict do nothing;
    perform private.bump_account(new.user_id);
    return new;
  end if;
  if new.availability<>'available' then
    for target in select distinct a.recipient_id as user_id from private.table_activity_events a
      where a.active and a.recipient_id is not null and (a.entry_id=new.id or a.reply_id=new.id) order by a.recipient_id loop
      perform private.bump_account(target.user_id);
    end loop;
    return new;
  end if;
  if new.author_id is null then return new; end if;
  if tg_op='UPDATE' then
    if old.body is not distinct from new.body then return new; end if;
    edited:=true;
  end if;
  for target in select p.id as period_id,p.user_id from public.membership_periods p
    join public.group_memberships m on m.group_id=p.group_id and m.user_id=p.user_id and m.state='active'
    join public.profiles person on person.id=p.user_id and person.state='active'
    where p.group_id=new.group_id and p.ended_at is null and p.user_id<>new.author_id order by p.user_id loop
    if edited then
      if strpos(new.body,'@['||target.user_id||']')=0 or strpos(old.body,'@['||target.user_id||']')>0 then continue; end if;
      event_kind:='mention';
    elsif tg_table_name='thread_replies' then event_kind:='reply';
    else event_kind:=case new.kind when 'request' then 'question' when 'plate_share' then 'share' else 'message' end;
    end if;
    insert into private.table_activity_events(recipient_id,sender_id,group_id,period_id,entry_id,reply_id,kind,source_version)
      values(target.user_id,new.author_id,new.group_id,target.period_id,
        case when tg_table_name='timeline_entries' then new.id end,
        case when tg_table_name='thread_replies' then new.id end,event_kind,new.updated_at) on conflict do nothing;
    perform private.bump_account(target.user_id);
  end loop;
  return new;
end $$;
create trigger activity_capture_entry after insert or update of body,availability on public.timeline_entries for each row execute function private.capture_table_activity();
create trigger activity_capture_reply after insert or update of body,availability on public.thread_replies for each row execute function private.capture_table_activity();
create trigger activity_capture_addition after insert on public.membership_periods for each row execute function private.capture_table_activity();

create view private.visible_table_activity as
  select a.*,g.name as table_name,p.display_name as sender_name,u.username as sender_username,
    strpos(coalesce(e.body,r.body,''),'@['||a.recipient_id||']')>0 as mentioned,
    case when a.reply_id is not null then '/tables/'||a.group_id||case root.kind when 'request' then '/requests/' else '/discussion/' end||root.id||'?reply='||r.id||'#reply-'||r.id
      when e.kind='message' then '/tables/'||a.group_id||'?entry='||e.id||'#entry-'||e.id
      when e.id is not null then '/tables/'||a.group_id||case e.kind when 'request' then '/requests/' else '/discussion/' end||e.id
      else '/tables/'||a.group_id end as destination
  from private.table_activity_events a
    join public.profiles p on p.id=a.sender_id and p.state='active'
    left join private.profile_usernames u on u.profile_id=p.id
    join public.groups g on g.id=a.group_id and g.availability='available'
    join public.membership_periods period on period.id=a.period_id and period.user_id=a.recipient_id and period.group_id=a.group_id and period.ended_at is null
    join public.group_memberships m on m.group_id=a.group_id and m.user_id=a.recipient_id and m.state='active'
    left join public.timeline_entries e on e.id=a.entry_id and e.group_id=a.group_id
    left join public.thread_replies r on r.id=a.reply_id and r.group_id=a.group_id
    left join public.threads t on t.id=r.thread_id and t.group_id=a.group_id
    left join public.timeline_entries root on root.id=t.root_entry_id and root.group_id=a.group_id
  where a.active and a.recipient_id=private.current_profile_id()
    and (a.kind='added' or e.availability='available' or (r.availability='available' and root.availability in ('available','removed')))
    and (a.kind<>'mention' or strpos(coalesce(e.body,r.body,''),'@['||a.recipient_id||']')>0);
revoke all on private.visible_table_activity from public,anon,authenticated,service_role;

create function public.table_activity_ready() returns boolean language sql stable security definer set search_path='' as $$select true$$;
create function public.table_activity_period(p_group_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select id from public.membership_periods where group_id=p_group_id and user_id=private.current_profile_id()
    and ended_at is null and private.is_active_member(p_group_id);
$$;
create function public.my_table_activity()
returns table(group_id uuid,table_name text,unread_count bigint,mention_count bigint,latest_id uuid,sender_name text,sender_username text,kind text,destination text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select grouped.group_id,latest.table_name,grouped.n,grouped.mentions,latest.id,latest.sender_name,latest.sender_username,latest.kind,latest.destination,latest.created_at
  from (select a.group_id,count(*) as n,count(distinct coalesce(a.entry_id,a.reply_id)) filter(where a.mentioned) as mentions from private.visible_table_activity a where a.read_at is null group by a.group_id) grouped
  cross join lateral (select a.* from private.visible_table_activity a where a.group_id=grouped.group_id and a.read_at is null order by a.created_at desc,a.id desc limit 1) latest
  order by latest.created_at desc,latest.id desc;
$$;
create function public.table_activity_receipts(p_group_id uuid,p_period_id uuid,p_entries jsonb default '[]',p_replies jsonb default '[]',p_membership boolean default false)
returns table(id uuid,entry_id uuid,reply_id uuid,kind text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_member(p_group_id) then raise exception 'Table membership required' using errcode='42501'; end if;
  if p_entries is null or p_replies is null or jsonb_typeof(p_entries)<>'array' or jsonb_typeof(p_replies)<>'array'
    or jsonb_array_length(p_entries)>200 or jsonb_array_length(p_replies)>200 then raise exception 'Bounded displayed sources required' using errcode='23514'; end if;
  return query select a.id,a.entry_id,a.reply_id,a.kind from private.visible_table_activity a
    where a.group_id=p_group_id and a.period_id=p_period_id and a.read_at is null and (
      (p_membership and a.kind='added') or exists(select 1 from jsonb_to_recordset(p_entries) as shown(id uuid,updated_at timestamptz) where shown.id=a.entry_id and shown.updated_at>=a.source_version)
      or exists(select 1 from jsonb_to_recordset(p_replies) as shown(id uuid,updated_at timestamptz) where shown.id=a.reply_id and shown.updated_at>=a.source_version))
    order by a.created_at,a.id limit 500;
end $$;
create function public.ack_table_activity(p_group_id uuid,p_period_id uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found then raise exception 'Active sign-in required' using errcode='42501'; end if;
  perform 1 from public.groups where id=p_group_id and availability='available' for share;
  if not found or not private.is_active_member(p_group_id) then raise exception 'Table membership required' using errcode='42501'; end if;
  if p_ids is null or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then raise exception 'Bounded receipt IDs required' using errcode='23514'; end if;
  update private.table_activity_events a set read_at=clock_timestamp()
    where a.id=any(p_ids) and a.recipient_id=actor and a.group_id=p_group_id and a.period_id=p_period_id and a.read_at is null
      and exists(select 1 from private.visible_table_activity visible where visible.id=a.id);
  if found then perform private.bump_account(actor); end if;
end $$;

-- Preserve existing eligible mentions when moving them out of the bell. Do not
-- backfill ordinary historical messages or alerts from a previous membership.
insert into private.table_activity_events(recipient_id,sender_id,group_id,period_id,entry_id,reply_id,kind,source_version,created_at,read_at)
  select n.recipient_id,n.sender_id,n.group_id,period.id,n.entry_id,n.reply_id,'mention',coalesce(e.updated_at,r.updated_at),n.created_at,n.read_at
  from private.mention_notifications n
    join public.profiles sender on sender.id=n.sender_id and sender.state='active'
    join public.profiles recipient on recipient.id=n.recipient_id and recipient.state='active'
    join public.groups g on g.id=n.group_id and g.availability='available'
    join public.group_memberships m on m.group_id=n.group_id and m.user_id=n.recipient_id and m.state='active'
    join public.membership_periods period on period.group_id=n.group_id and period.user_id=n.recipient_id and period.ended_at is null and n.created_at>=period.joined_at
    left join public.timeline_entries e on e.id=n.entry_id and e.availability='available'
    left join public.thread_replies r on r.id=n.reply_id and r.availability='available'
  where n.active and n.sender_id<>n.recipient_id and (e.id is not null or r.id is not null) on conflict do nothing;

create function private.clear_erased_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state='erased' or (new.state<>'active' and exists(select 1 from private.account_erasure_jobs where profile_id=new.id)) then
    update private.table_activity_events set active=false,recipient_id=null,sender_id=null,group_id=null,period_id=null,entry_id=null,reply_id=null,source_version=null,read_at=null
      where recipient_id=new.id or sender_id=new.id;
    update private.follow_acceptance_notifications set edge_id=null,recipient_id=null,sender_id=null,read_at=null where recipient_id=new.id or sender_id=new.id;
  end if;
  return new;
end $$;
create trigger profiles_clear_table_notifications after update of state on public.profiles for each row execute function private.clear_erased_activity();

revoke all on function private.capture_follow_acceptance(),private.capture_table_activity(),private.clear_erased_activity() from public,anon,authenticated,service_role;
revoke all on function public.table_activity_ready(),public.table_activity_period(uuid),public.my_table_activity(),public.table_activity_receipts(uuid,uuid,jsonb,jsonb,boolean),public.ack_table_activity(uuid,uuid,uuid[]),public.my_follow_notifications(),public.read_follow_notification(uuid) from public,anon,authenticated,service_role;
grant execute on function public.table_activity_ready(),public.table_activity_period(uuid),public.my_table_activity(),public.table_activity_receipts(uuid,uuid,jsonb,jsonb,boolean),public.ack_table_activity(uuid,uuid,uuid[]),public.my_follow_notifications(),public.read_follow_notification(uuid) to authenticated;
commit;
