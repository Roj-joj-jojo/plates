-- Candidate only. Flat direct Plate comments/likes; no physical deletion or activation.
begin;
create table private.plate_likes (
  id uuid primary key default gen_random_uuid(),
  plate_id uuid not null references public.plates(id) on delete restrict,
  profile_id uuid references public.profiles(id) on delete restrict,
  active boolean not null default true,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(plate_id,profile_id), check(profile_id is not null or not active)
);
create index plate_likes_count on private.plate_likes(plate_id) where active;
create table private.plate_comments (
  id uuid primary key default gen_random_uuid(),
  plate_id uuid not null references public.plates(id) on delete restrict,
  author_id uuid references public.profiles(id) on delete restrict,
  client_request_id uuid,
  request_hash bytea,
  body text not null,
  state text not null default 'available' check(state in ('available','removed','erased')),
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default clock_timestamp(),
  edited_at timestamptz,
  unique(author_id,client_request_id),
  check((state='available' and author_id is not null and client_request_id is not null
      and request_hash is not null and char_length(body) between 1 and 2000 and body ~ '[^[:space:]]')
    or (state='removed' and author_id is not null and client_request_id is not null and body='' and request_hash is null)
    or (state='erased' and author_id is null and client_request_id is null and body='' and request_hash is null))
);
create index plate_comments_page on private.plate_comments(plate_id,created_at desc,id desc);
create index plate_comments_author on private.plate_comments(author_id);
create table private.plate_comment_notifications (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid unique references private.plate_comments(id) on delete restrict,
  recipient_id uuid references public.profiles(id) on delete restrict,
  sender_id uuid references public.profiles(id) on delete restrict,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check((comment_id is not null and recipient_id is not null and sender_id is not null)
    or (comment_id is null and recipient_id is null and sender_id is null))
);
create index plate_comment_notifications_recipient on private.plate_comment_notifications(recipient_id,created_at desc);
alter table private.plate_likes enable row level security;
alter table private.plate_comments enable row level security;
alter table private.plate_comment_notifications enable row level security;
revoke all on private.plate_likes,private.plate_comments,private.plate_comment_notifications from public,anon,authenticated,service_role;
create trigger plate_likes_no_delete before delete on private.plate_likes for each row execute function private.reject_m2_delete();
create trigger plate_comments_no_delete before delete on private.plate_comments for each row execute function private.reject_m2_delete();
create trigger plate_comment_notifications_no_delete before delete on private.plate_comment_notifications for each row execute function private.reject_m2_delete();

create function public.plate_interactions_ready() returns boolean language sql stable set search_path='' as $$ select true $$;

-- Profile locks serialize privacy/follow/erasure changes; Plate lock serializes unpublish.
create function private.lock_plate_interaction(p_plate uuid,p_comment_author uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); author_key uuid;
begin
  if actor is null then raise exception 'Active sign-in required' using errcode='42501'; end if;
  select author_id into author_key from public.plates where id=p_plate;
  perform 1 from public.profiles where id in(actor,author_key,p_comment_author) order by id for share;
  perform 1 from public.plates where id=p_plate and author_id=author_key and availability='available' for share;
  if not found or private.current_profile_id() is distinct from actor or not private.can_view_plate(p_plate) then
    raise exception 'Plate unavailable' using errcode='42501'; end if;
  return actor;
end $$;
create function private.signal_plate_interaction(p_plate uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid; author_key uuid; open_account boolean;
begin
  select p.author_id,not coalesce(a.is_private,false) into author_key,open_account
    from public.plates p left join private.account_privacy a on a.profile_id=p.author_id where p.id=p_plate;
  for target in select distinct audience.id from (
    select p_actor as id union select author_key
    union select follower_id from private.follow_edges where author_id=author_key and state='approved'
    union select c.author_id from private.plate_comments c where c.plate_id=p_plate and c.author_id is not null
      and (open_account or c.author_id=author_key or exists(select 1 from private.follow_edges f
        where f.follower_id=c.author_id and f.author_id=author_key and f.state='approved'))
    union select l.profile_id from private.plate_likes l where l.plate_id=p_plate and l.profile_id is not null
      and (open_account or l.profile_id=author_key or exists(select 1 from private.follow_edges f
        where f.follower_id=l.profile_id and f.author_id=author_key and f.state='approved'))
  ) audience join public.profiles p on p.id=audience.id and p.state='active' order by audience.id loop
    perform private.bump_account(target);
  end loop;
end $$;
create function public.plate_interaction_summary(p_plate_ids uuid[])
returns table(plate_id uuid,like_count bigint,comment_count bigint,liked boolean,like_version bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_plate_ids is null or cardinality(p_plate_ids)>100 then raise exception 'Use at most 100 Plates' using errcode='23514'; end if;
  return query select p.id,
    (select count(*) from private.plate_likes l where l.plate_id=p.id and l.active),
    (select count(*) from private.plate_comments c where c.plate_id=p.id and c.state='available'),
    coalesce(mine.active,false),coalesce(mine.version,0)
    from public.plates p left join private.plate_likes mine on mine.plate_id=p.id and mine.profile_id=private.current_profile_id()
    where p.id=any(p_plate_ids) and private.can_view_plate(p.id);
end $$;
create function public.set_plate_like(p_plate_id uuid,p_liked boolean,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_plate_interaction(p_plate_id); edge private.plate_likes%rowtype;
begin
  if p_liked is null or p_expected_version is null or p_expected_version<0 then
    raise exception 'Choose a like state' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||'/'||p_plate_id::text,7343104));
  select * into edge from private.plate_likes where plate_id=p_plate_id and profile_id=actor for update;
  if found then
    if edge.version=p_expected_version+1 and edge.active=p_liked then return edge.version; end if;
    if edge.version<>p_expected_version then raise exception 'Like changed; refresh' using errcode='40001'; end if;
    if edge.active=p_liked then return edge.version; end if;
    update private.plate_likes set active=p_liked,version=version+1,updated_at=clock_timestamp() where id=edge.id;
    perform private.signal_plate_interaction(p_plate_id,actor);
    return edge.version+1;
  end if;
  if p_expected_version<>0 then raise exception 'Like changed; refresh' using errcode='40001'; end if;
  if not p_liked then return 0; end if;
  insert into private.plate_likes(plate_id,profile_id) values(p_plate_id,actor);
  perform private.signal_plate_interaction(p_plate_id,actor);
  return 1;
end $$;
create function private.valid_plate_comment(p_body text) returns boolean
language sql immutable set search_path='' as $$
  select p_body is not null and char_length(btrim(p_body)) between 1 and 2000 and p_body ~ '[^[:space:]]'
    and regexp_replace(p_body,E'[\n\r\t]','','g') !~ '[[:cntrl:]]';
$$;
create function public.create_plate_comment(p_plate_id uuid,p_client_request_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_plate_interaction(p_plate_id); old_comment private.plate_comments%rowtype;
  fingerprint bytea; fresh uuid; recipient uuid;
begin
  if p_client_request_id is null or not private.valid_plate_comment(p_body) then
    raise exception 'Use 1–2000 characters for your comment' using errcode='23514'; end if;
  fingerprint:=sha256(convert_to(btrim(p_body),'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(actor::text||'/'||p_client_request_id::text,7343105));
  select * into old_comment from private.plate_comments where author_id=actor and client_request_id=p_client_request_id;
  if found then
    if old_comment.plate_id<>p_plate_id or (old_comment.state='available' and old_comment.request_hash is distinct from fingerprint) then
      raise exception 'Comment request changed' using errcode='23514'; end if;
    return old_comment.id;
  end if;
  insert into private.plate_comments(plate_id,author_id,client_request_id,request_hash,body)
    values(p_plate_id,actor,p_client_request_id,fingerprint,btrim(p_body)) returning id into fresh;
  select author_id into recipient from public.plates where id=p_plate_id;
  if recipient<>actor then insert into private.plate_comment_notifications(comment_id,recipient_id,sender_id)
    values(fresh,recipient,actor); end if;
  perform private.signal_plate_interaction(p_plate_id,actor);
  return fresh;
end $$;
create function public.edit_plate_comment(p_comment_id uuid,p_expected_revision bigint,p_body text)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid; target private.plate_comments%rowtype;
begin
  select * into target from private.plate_comments where id=p_comment_id;
  if not found then raise exception 'Comment unavailable' using errcode='42501'; end if;
  actor:=private.lock_plate_interaction(target.plate_id,target.author_id);
  select * into target from private.plate_comments where id=p_comment_id for update;
  if target.author_id is distinct from actor then raise exception 'Your comment required' using errcode='42501'; end if;
  if target.state<>'available' then raise exception 'Comment unavailable' using errcode='23514'; end if;
  if p_expected_revision is null or p_expected_revision<1 or not private.valid_plate_comment(p_body) then
    raise exception 'Use 1–2000 characters for your comment' using errcode='23514'; end if;
  if target.revision=p_expected_revision+1 and target.body=btrim(p_body) then return target.revision; end if;
  if target.revision<>p_expected_revision then raise exception 'Comment changed; refresh' using errcode='40001'; end if;
  if target.body=btrim(p_body) then return target.revision; end if;
  update private.plate_comments set body=btrim(p_body),revision=revision+1,edited_at=clock_timestamp() where id=p_comment_id;
  perform private.signal_plate_interaction(target.plate_id,actor);
  return target.revision+1;
end $$;
create function public.remove_plate_comment(p_comment_id uuid,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid; target private.plate_comments%rowtype; plate_author uuid;
begin
  select * into target from private.plate_comments where id=p_comment_id;
  if not found then raise exception 'Comment unavailable' using errcode='42501'; end if;
  actor:=private.lock_plate_interaction(target.plate_id,target.author_id);
  select * into target from private.plate_comments where id=p_comment_id for update;
  select author_id into plate_author from public.plates where id=target.plate_id;
  if actor is distinct from target.author_id and actor is distinct from plate_author then
    raise exception 'Comment author or Plate author required' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<1 then raise exception 'Comment revision required' using errcode='23514'; end if;
  if target.state='removed' and target.revision=p_expected_revision+1 then return target.revision; end if;
  if target.state<>'available' then raise exception 'Comment unavailable' using errcode='23514'; end if;
  if target.revision<>p_expected_revision then raise exception 'Comment changed; refresh' using errcode='40001'; end if;
  update private.plate_comments set state='removed',body='',request_hash=null,revision=revision+1 where id=p_comment_id;
  perform private.signal_plate_interaction(target.plate_id,actor);
  return target.revision+1;
end $$;

create view private.plate_comment_read_model as
  select c.id,c.plate_id,case when c.state='available' then p.id end as author_id,
    case when c.state='available' then p.display_name end as author_name,
    case when c.state='available' then u.username end as author_username,
    case when c.state='available' then c.body else '' end as body,c.state,c.revision,c.created_at,c.edited_at,
    (c.state='available' and c.author_id=private.current_profile_id()) as can_edit,
    (c.state='available' and (c.author_id=private.current_profile_id() or plate.author_id=private.current_profile_id())) as can_remove
  from private.plate_comments c join public.plates plate on plate.id=c.plate_id
    left join public.profiles p on p.id=c.author_id and p.state='active'
    left join private.profile_usernames u on u.profile_id=p.id
  where private.can_view_plate(c.plate_id);
revoke all on private.plate_comment_read_model from public,anon,authenticated,service_role;
create function public.plate_comments_page(p_plate_id uuid,p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,plate_id uuid,author_id uuid,author_name text,author_username text,body text,
  state text,revision bigint,created_at timestamptz,edited_at timestamptz,can_edit boolean,can_remove boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if (p_before is null)<>(p_before_id is null) or (p_before is not null and not isfinite(p_before)) then
    raise exception 'Use a complete comment cursor' using errcode='23514'; end if;
  return query select c.* from private.plate_comment_read_model c where c.plate_id=p_plate_id
    and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id))
    order by c.created_at desc,c.id desc limit 30;
end $$;
create function public.plate_comment_by_id(p_plate_id uuid,p_comment_id uuid)
returns table(id uuid,plate_id uuid,author_id uuid,author_name text,author_username text,body text,
  state text,revision bigint,created_at timestamptz,edited_at timestamptz,can_edit boolean,can_remove boolean)
language sql stable security definer set search_path='' as $$
  select c.* from private.plate_comment_read_model c where c.plate_id=p_plate_id and c.id=p_comment_id;
$$;
create function public.my_plate_comment_notifications()
returns table(id uuid,plate_id uuid,comment_id uuid,sender_name text,sender_username text,read_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select n.id,c.plate_id,c.id,p.display_name,u.username,n.read_at,n.created_at
    from private.plate_comment_notifications n join private.plate_comments c on c.id=n.comment_id and c.state='available'
    join public.profiles p on p.id=n.sender_id and p.state='active'
    left join private.profile_usernames u on u.profile_id=p.id
    where n.recipient_id=private.current_profile_id() and private.can_view_plate(c.plate_id)
    order by n.created_at desc,n.id desc limit 100;
$$;
create function public.read_plate_comment_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found then raise exception 'Active sign-in required' using errcode='42501'; end if;
  update private.plate_comment_notifications n set read_at=coalesce(n.read_at,clock_timestamp())
    where n.id=p_id and n.recipient_id=actor and exists(select 1 from private.plate_comments c
      where c.id=n.comment_id and c.state='available' and private.can_view_plate(c.plate_id));
  if found then perform private.bump_account(actor); end if;
end $$;

-- Existing recorded-erasure/profile cutoff (including restore replay) invokes this hook.
create function private.clear_erased_plate_interactions() returns trigger
language plpgsql security definer set search_path='' as $$
declare owned_plates uuid[]; affected_comments uuid[]; affected_plates uuid[]; target uuid;
begin
  if new.state='active' then return new; end if;
  select coalesce(array_agg(id),'{}') into owned_plates from public.plates where author_id=new.id;
  select coalesce(array_agg(id),'{}') into affected_comments from private.plate_comments
    where author_id=new.id or plate_id=any(owned_plates);
  select coalesce(array_agg(distinct id),'{}') into affected_plates from (
    select plate_id as id from private.plate_comments where id=any(affected_comments)
    union select plate_id from private.plate_likes where profile_id=new.id
  ) affected;
  update private.plate_likes set active=false,profile_id=null,version=version+1,updated_at=clock_timestamp()
    where profile_id=new.id or plate_id=any(owned_plates);
  update private.plate_comments set state='erased',author_id=null,client_request_id=null,request_hash=null,body='',revision=revision+1
    where id=any(affected_comments);
  update private.plate_comment_notifications set comment_id=null,recipient_id=null,sender_id=null
    where recipient_id=new.id or sender_id=new.id or comment_id=any(affected_comments);
  foreach target in array affected_plates loop perform private.signal_plate_interaction(target,null); end loop;
  return new;
end $$;
create trigger profiles_clear_plate_interactions after update of state on public.profiles
  for each row execute function private.clear_erased_plate_interactions();

-- Prompt prior readers to recheck access on privacy/unpublish changes; no content in signals.
create function private.signal_interaction_access(p_plate uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  for target in select distinct audience.id from (
    select author_id as id from private.plate_comments where plate_id=p_plate
    union select profile_id from private.plate_likes where plate_id=p_plate
  ) audience join public.profiles p on p.id=audience.id and p.state='active' order by audience.id loop
    perform private.bump_account(target);
  end loop;
end $$;
create function private.signal_interaction_access_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if tg_table_name='plates' then perform private.signal_interaction_access(new.id);
  else
    for target in select id from public.plates where author_id=new.profile_id order by id loop
      perform private.signal_interaction_access(target);
    end loop;
  end if;
  return new;
end $$;
create trigger plates_interaction_access after update of availability on public.plates
  for each row when(old.availability is distinct from new.availability) execute function private.signal_interaction_access_change();
create trigger privacy_interaction_access after update of is_private on private.account_privacy
  for each row when(old.is_private is distinct from new.is_private) execute function private.signal_interaction_access_change();

revoke all on function private.lock_plate_interaction(uuid,uuid),private.signal_plate_interaction(uuid,uuid),
  private.valid_plate_comment(text),private.clear_erased_plate_interactions(),
  private.signal_interaction_access(uuid),private.signal_interaction_access_change(),
  public.plate_interactions_ready(),public.plate_interaction_summary(uuid[]),public.set_plate_like(uuid,boolean,bigint),
  public.create_plate_comment(uuid,uuid,text),public.edit_plate_comment(uuid,bigint,text),public.remove_plate_comment(uuid,bigint),
  public.plate_comments_page(uuid,timestamptz,uuid),public.plate_comment_by_id(uuid,uuid),
  public.my_plate_comment_notifications(),public.read_plate_comment_notification(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.plate_interactions_ready(),public.plate_interaction_summary(uuid[]),public.set_plate_like(uuid,boolean,bigint),
  public.create_plate_comment(uuid,uuid,text),public.edit_plate_comment(uuid,bigint,text),public.remove_plate_comment(uuid,bigint),
  public.plate_comments_page(uuid,timestamptz,uuid),public.plate_comment_by_id(uuid,uuid),
  public.my_plate_comment_notifications(),public.read_plate_comment_notification(uuid) to authenticated;
commit;
