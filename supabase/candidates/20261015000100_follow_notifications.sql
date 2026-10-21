-- Candidate only. No activation, historical backfill or physical deletion.
begin;
create table private.follow_notifications (
  id uuid primary key default gen_random_uuid(),
  edge_id uuid references private.follow_edges(id) on delete restrict,
  edge_version bigint not null,
  recipient_id uuid references public.profiles(id) on delete restrict,
  sender_id uuid references public.profiles(id) on delete restrict,
  kind text not null check(kind in ('follow_request','new_follower')),
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(edge_id,edge_version),
  check((edge_id is null and recipient_id is null and sender_id is null)
    or (edge_id is not null and recipient_id is not null and sender_id is not null))
);
create index follow_notifications_recipient on private.follow_notifications(recipient_id,created_at desc);
alter table private.follow_notifications enable row level security;
revoke all on private.follow_notifications from public,anon,authenticated,service_role;
create trigger follow_notifications_no_delete before delete on private.follow_notifications
  for each row execute function private.reject_m2_delete();

create function private.capture_follow_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state='erased' then
    update private.follow_notifications set edge_id=null,recipient_id=null,sender_id=null,
      resolved_at=coalesce(resolved_at,clock_timestamp()) where edge_id=new.id;
    return new;
  end if;
  if tg_op='UPDATE' then
    if old.state is not distinct from new.state then return new; end if;
    update private.follow_notifications set resolved_at=coalesce(resolved_at,clock_timestamp())
      where edge_id=new.id and resolved_at is null;
    -- Approval is the recipient's own action; resolving the request is sufficient.
    if old.state='pending' and new.state='approved' then return new; end if;
  end if;
  if new.state in ('pending','approved') then
    insert into private.follow_notifications(edge_id,edge_version,recipient_id,sender_id,kind)
      values(new.id,new.version,new.author_id,new.follower_id,
        case new.state when 'pending' then 'follow_request' else 'new_follower' end)
      on conflict(edge_id,edge_version) do nothing;
  end if;
  return new;
end $$;
create trigger follow_notification_capture after insert or update on private.follow_edges
  for each row execute function private.capture_follow_notification();

-- Activation includes current actionable requests, not historical follower alerts.
insert into private.follow_notifications(edge_id,edge_version,recipient_id,sender_id,kind)
  select id,version,author_id,follower_id,'follow_request' from private.follow_edges where state='pending';

create function public.my_follow_notifications()
returns table(id uuid,kind text,sender_id uuid,sender_name text,sender_username text,edge_id uuid,
  edge_version bigint,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,n.kind,p.id,p.display_name,u.username,n.edge_id,f.version,n.read_at,n.created_at
    from private.follow_notifications n
    join private.follow_edges f on f.id=n.edge_id and f.version=n.edge_version
    join public.profiles p on p.id=n.sender_id and p.state='active'
    join private.profile_usernames u on u.profile_id=p.id and u.username is not null
    where n.recipient_id=private.current_profile_id() and n.resolved_at is null
      and f.author_id=n.recipient_id and f.follower_id=n.sender_id
      and ((n.kind='follow_request' and f.state='pending') or (n.kind='new_follower' and f.state='approved'))
    order by (n.kind='follow_request') desc,n.created_at desc,n.id desc limit 100;
$$;
create function public.read_follow_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found then raise exception 'Active sign-in required' using errcode='42501'; end if;
  update private.follow_notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_id and recipient_id=actor and resolved_at is null;
  if found then perform private.bump_account(actor); end if;
end $$;
revoke all on function private.capture_follow_notification(),public.my_follow_notifications(),
  public.read_follow_notification(uuid) from public,anon,authenticated,service_role;
grant execute on function public.my_follow_notifications(),public.read_follow_notification(uuid) to authenticated;
commit;
