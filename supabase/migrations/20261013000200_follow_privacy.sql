-- Candidate only; activation requires separate owner approval.
begin;
create table private.account_privacy (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  is_private boolean not null default false,
  bio text not null default '' check(char_length(bio)<=160),
  version bigint not null default 0 check(version>=0)
);
create table private.follow_edges (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.profiles(id) on delete restrict,
  author_id uuid references public.profiles(id) on delete restrict,
  state text not null check(state in ('pending','approved','inactive','erased')),
  version bigint not null default 1 check(version>0),
  updated_at timestamptz not null default clock_timestamp(),
  unique(follower_id,author_id),
  check(follower_id<>author_id),
  check((state='erased' and follower_id is null and author_id is null)
    or (state<>'erased' and follower_id is not null and author_id is not null))
);
create index follow_edges_author on private.follow_edges(author_id,state);
revoke all on private.account_privacy,private.follow_edges from public,anon,authenticated,service_role;

create function public.social_ready() returns boolean language sql stable as $$ select true $$;
create function private.can_view_author(p_author uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_profile_id() is not null and exists(
    select 1 from public.profiles p where p.id=p_author and p.state='active' and (
      p.id=private.current_profile_id()
      or not coalesce((select is_private from private.account_privacy where profile_id=p.id),false)
      or exists(select 1 from private.follow_edges f where f.author_id=p.id
        and f.follower_id=private.current_profile_id() and f.state='approved')));
$$;
create function private.can_view_plate(p_plate uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.plates p where p.id=p_plate and p.availability='available'
    and private.can_view_author(p.author_id));
$$;
alter policy plates_read on public.plates using(private.can_view_plate(id));

-- Names, handles and avatars are discoverable; Plate access is separately guarded.
create or replace function private.can_read_profile(p_profile_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_profile_id() is not null and exists(select 1 from public.profiles p
    where p.id=p_profile_id and p.state='active' and (p.id=private.current_profile_id()
      or exists(select 1 from private.profile_usernames u where u.profile_id=p.id and u.username is not null)
      or exists(select 1 from public.group_memberships mine join public.group_memberships peer on peer.group_id=mine.group_id
        join public.groups g on g.id=mine.group_id where mine.user_id=private.current_profile_id()
        and mine.state='active' and peer.user_id=p.id and peer.state='active' and g.availability='available')));
$$;
create function public.social_person(p_profile_id uuid)
returns table(profile_id uuid,username text,display_name text,is_private boolean,is_me boolean,follow_state text,follow_version bigint)
language sql stable security definer set search_path='' as $$
  select p.id,u.username,p.display_name,coalesce(a.is_private,false),p.id=private.current_profile_id(),
    coalesce(f.state,'inactive'),coalesce(f.version,0)
  from public.profiles p join private.profile_usernames u on u.profile_id=p.id
  left join private.account_privacy a on a.profile_id=p.id
  left join private.follow_edges f on f.author_id=p.id and f.follower_id=private.current_profile_id()
  where p.id=p_profile_id and p.state='active' and u.username is not null and private.current_profile_id() is not null;
$$;
create function public.search_people(p_query text,p_offset integer default 0)
returns table(profile_id uuid,username text,display_name text,is_private boolean,is_me boolean,follow_state text,follow_version bigint)
language plpgsql stable security definer set search_path='' as $$
declare term text:=lower(ltrim(btrim(p_query),'@'));
begin
  if private.current_profile_id() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if term is null or char_length(term) not between 1 and 100 or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Use 1–100 characters' using errcode='23514'; end if;
  return query select r.* from public.profiles p join private.profile_usernames u on u.profile_id=p.id
    cross join lateral public.social_person(p.id) r
    where p.state='active' and (position(term in lower(u.username))>0 or position(term in lower(p.display_name))>0)
    order by (lower(u.username)=term) desc,lower(u.username),p.id limit 30 offset p_offset;
end $$;
create function public.my_social_people(p_list text,p_offset integer default 0)
returns table(profile_id uuid,username text,display_name text,is_private boolean,is_me boolean,follow_state text,follow_version bigint,edge_id uuid,edge_version bigint)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id();
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_list is null or p_list not in ('following','requests','followers','sent') or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Choose a valid list' using errcode='23514'; end if;
  return query select r.*,f.id,f.version from private.follow_edges f
    cross join lateral public.social_person(case when p_list in ('following','sent') then f.author_id else f.follower_id end) r
    where case when p_list='following' then f.follower_id=actor and f.state='approved'
      when p_list='sent' then f.follower_id=actor and f.state='pending'
      when p_list='requests' then f.author_id=actor and f.state='pending'
      else f.author_id=actor and f.state='approved' end
    order by f.updated_at desc,f.id limit 30 offset p_offset;
end $$;
create function public.my_privacy() returns table(is_private boolean,version bigint,bio text)
language sql stable security definer set search_path='' as $$
  select coalesce(a.is_private,false),coalesce(a.version,0),coalesce(a.bio,'') from public.profiles p
    left join private.account_privacy a on a.profile_id=p.id where p.id=private.current_profile_id();
$$;
create function public.set_my_privacy(p_private boolean,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); current_setting private.account_privacy%rowtype;
begin
  perform 1 from public.profiles where id=actor and state='active' for update;
  if not found then raise exception 'Active account required' using errcode='42501'; end if;
  if p_private is null or p_expected_version is null then raise exception 'Choose privacy' using errcode='23514'; end if;
  insert into private.account_privacy(profile_id) values(actor) on conflict do nothing;
  select * into current_setting from private.account_privacy where profile_id=actor for update;
  if current_setting.version=p_expected_version+1 and current_setting.is_private=p_private then return; end if;
  if current_setting.version<>p_expected_version then raise exception 'Settings changed; refresh' using errcode='40001'; end if;
  if current_setting.is_private=p_private then return; end if;
  update private.account_privacy set is_private=p_private,version=version+1 where profile_id=actor;
  if not p_private then update private.follow_edges set state='approved',version=version+1,updated_at=clock_timestamp()
    where author_id=actor and state='pending'; end if;
  perform private.bump_account(actor);
  -- Refresh current followers and Table previews without broadcasting private content.
  perform private.bump_account(follower_id) from private.follow_edges where author_id=actor and state='approved';
  perform private.bump_conversation(e.group_id) from public.plate_shares s join public.plates p on p.id=s.plate_id
    join public.timeline_entries e on e.id=s.entry_id where p.author_id=actor;
end $$;
create function public.set_follow(p_author_id uuid,p_follow boolean,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); edge private.follow_edges%rowtype; desired text;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  perform 1 from public.profiles where id in(actor,p_author_id) order by id for update;
  if p_author_id is null or actor=p_author_id or p_follow is null or p_expected_version is null
    or not exists(select 1 from public.profiles p join private.profile_usernames u on u.profile_id=p.id
      where p.id=p_author_id and p.state='active' and u.username is not null)
    or private.current_profile_id() is distinct from actor then raise exception 'Choose an active person' using errcode='42501'; end if;
  select * into edge from private.follow_edges where follower_id=actor and author_id=p_author_id for update;
  desired:=case when not p_follow then 'inactive' when edge.state='approved' then 'approved'
    when coalesce((select is_private from private.account_privacy where profile_id=p_author_id),false) then 'pending' else 'approved' end;
  if found then
    if edge.version=p_expected_version+1 and edge.state=desired then return; end if;
    if edge.version<>p_expected_version then raise exception 'Following changed; refresh' using errcode='40001'; end if;
    if edge.state=desired then return; end if;
    update private.follow_edges set state=desired,version=version+1,updated_at=clock_timestamp() where id=edge.id;
  else
    if p_expected_version<>0 then raise exception 'Following changed; refresh' using errcode='40001'; end if;
    if not p_follow then return; end if;
    insert into private.follow_edges(follower_id,author_id,state) values(actor,p_author_id,desired);
  end if;
end $$;
create function public.respond_follow(p_edge_id uuid,p_accept boolean,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); edge private.follow_edges%rowtype; desired text;
begin
  select * into edge from private.follow_edges where id=p_edge_id and author_id=actor;
  if not found or actor is null then raise exception 'Your follower request required' using errcode='42501'; end if;
  perform 1 from public.profiles where id in(actor,edge.follower_id) order by id for update;
  select * into edge from private.follow_edges where id=p_edge_id and author_id=actor for update;
  if edge.state='erased' or private.current_profile_id() is distinct from actor
    or not exists(select 1 from public.profiles where id=edge.follower_id and state='active') then
    raise exception 'Request unavailable' using errcode='42501'; end if;
  if p_accept is null or p_expected_version is null then raise exception 'Choose a response' using errcode='23514'; end if;
  desired:=case when p_accept then 'approved' else 'inactive' end;
  if edge.version=p_expected_version+1 and edge.state=desired then return; end if;
  if edge.version<>p_expected_version then raise exception 'Request changed; refresh' using errcode='40001'; end if;
  if p_accept and edge.state<>'pending' then raise exception 'Pending request required' using errcode='23514'; end if;
  if edge.state=desired then return; end if;
  update private.follow_edges set state=desired,version=version+1,updated_at=clock_timestamp() where id=edge.id;
end $$;
create function private.social_edge_signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.bump_account(new.follower_id); perform private.bump_account(new.author_id);
  if tg_op='UPDATE' then
    if old.follower_id is distinct from new.follower_id then perform private.bump_account(old.follower_id); end if;
    if old.author_id is distinct from new.author_id then perform private.bump_account(old.author_id); end if;
  end if;
  return new;
end $$;
create trigger follow_edge_signal after insert or update on private.follow_edges for each row execute function private.social_edge_signal();
create function private.clear_erased_social() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state<>'active' then
    update private.follow_edges set state='erased',follower_id=null,author_id=null,version=version+1
      where follower_id=new.id or author_id=new.id;
    update private.account_privacy set is_private=false,bio='',version=version+1 where profile_id=new.id;
  end if;
  return new;
end $$;
create trigger profiles_clear_social after update of state on public.profiles for each row execute function private.clear_erased_social();

-- Definer photo reads must use the same guard as Plate row reads.
create or replace function private.can_read_plate_object(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select p_bucket='plate-media' and exists(select 1 from public.media_assets a
    join public.plate_media pm on pm.asset_id=a.id where a.bucket_id=p_bucket and a.object_path=p_path
      and private.can_view_plate(pm.plate_id));
$$;
create or replace function public.plate_image_locations(p_plate_id uuid)
returns table(asset_id uuid,object_path text,width integer,height integer,image_position integer)
language sql stable security definer set search_path='' as $$
  select a.id,a.object_path,a.width,a.height,pm.position from public.plate_media pm
    join public.media_assets a on a.id=pm.asset_id where pm.plate_id=p_plate_id and private.can_view_plate(p_plate_id)
    order by pm.position;
$$;
create function public.private_table_plates(p_group_id uuid,p_ids uuid[])
returns table(plate_id uuid,author_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_member(p_group_id) or p_ids is null or cardinality(p_ids)>100 then
    raise exception 'Table membership required' using errcode='42501'; end if;
  return query select distinct p.id,p.author_id from public.plates p join public.plate_shares s on s.plate_id=p.id
    join public.timeline_entries e on e.id=s.entry_id
    where e.group_id=p_group_id and e.availability='available' and p.id=any(p_ids) and p.availability='available'
      and not private.can_view_plate(p.id) and exists(select 1 from public.profiles a where a.id=p.author_id and a.state='active');
end $$;
create function private.is_following(p_author uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_profile_id() is not null and exists(select 1 from private.follow_edges
    where author_id=p_author and follower_id=private.current_profile_id() and state='approved');
$$;
-- Feed uses RLS and additionally excludes open authors who are not followed.
create function public.following_feed(p_before timestamptz default null,p_before_id uuid default null)
returns table(id uuid,author_id uuid,category_id uuid,body text,links jsonb,created_at timestamptz,revision bigint)
language sql stable security invoker set search_path='' as $$
  select p.id,p.author_id,p.category_id,p.body,p.links,p.created_at,p.revision from public.plates p
    where (p.author_id=private.current_profile_id() or private.is_following(p.author_id))
      and (p_before is null or (p.created_at,p.id)<(p_before,p_before_id))
    order by p.created_at desc,p.id desc limit 30;
$$;

revoke all on function public.social_ready(),public.social_person(uuid),public.search_people(text,integer),
  public.my_social_people(text,integer),public.my_privacy(),public.set_my_privacy(boolean,bigint),
  public.set_follow(uuid,boolean,bigint),public.respond_follow(uuid,boolean,bigint),
  public.private_table_plates(uuid,uuid[]),public.following_feed(timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.social_ready(),public.social_person(uuid),public.search_people(text,integer),
  public.my_social_people(text,integer),public.my_privacy(),public.set_my_privacy(boolean,bigint),
  public.set_follow(uuid,boolean,bigint),public.respond_follow(uuid,boolean,bigint),
  public.private_table_plates(uuid,uuid[]),public.following_feed(timestamptz,uuid) to authenticated;
revoke all on function private.can_view_author(uuid),private.can_view_plate(uuid),private.is_following(uuid),
  private.social_edge_signal(),private.clear_erased_social() from public,anon,authenticated,service_role;
grant execute on function private.can_view_plate(uuid),private.is_following(uuid) to authenticated;
create or replace function public.save_plate(p_plate_id uuid, p_expected_revision bigint,
  p_source_share_id uuid default null, p_preview_asset_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id(); author_key uuid;
  current_plate public.plates%rowtype; reminder public.menu_plate_saves%rowtype;
  author_name text; category_label text; result uuid;
begin
  if actor is null then raise exception 'Active sign-in required' using errcode = '42501'; end if;
  select author_id into author_key from public.plates where id = p_plate_id;
  if not found then raise exception 'Plate unavailable' using errcode = '42501'; end if;
  perform 1 from public.profiles where id in (actor, author_key) order by id for share;
  if private.current_profile_id() is distinct from actor then
    raise exception 'Active sign-in required' using errcode = '42501'; end if;
  if p_source_share_id is not null then perform private.lock_menu_source(p_source_share_id, p_plate_id); end if;
  select * into current_plate from public.plates where id = p_plate_id for share;
  if not found or current_plate.author_id is distinct from author_key then
    raise exception 'Plate unavailable' using errcode = '42501'; end if;
  if not private.can_view_plate(p_plate_id) then raise exception 'Plate unavailable' using errcode='42501'; end if;
  select label into category_label from public.categories where id = current_plate.category_id for share;
  select * into reminder from public.menu_plate_saves where saver_id = actor and plate_id = p_plate_id for update;
  if found then
    result := reminder.id;
    if p_preview_asset_id is not null and p_preview_asset_id is distinct from reminder.preview_asset_id then
      raise exception 'Saved preview cannot be changed' using errcode = '23514'; end if;
    if p_source_share_id is not null and
      (reminder.availability <> 'available' or current_plate.availability <> 'available') then
      raise exception 'Cannot add a source to an unavailable Plate or reminder' using errcode = '42501'; end if;
  else
    if current_plate.availability <> 'available' then raise exception 'Plate unavailable' using errcode = '42501'; end if;
    if p_expected_revision is distinct from current_plate.revision then
      raise exception 'Plate changed; refresh before first save' using errcode = '40001'; end if;
    select display_name into author_name from public.profiles where id = author_key;
    if author_name is null or category_label is null then
      raise exception 'Plate attribution unavailable' using errcode = '42501'; end if;
    insert into public.menu_plate_saves(saver_id, plate_id, snapshot_revision, snapshot_body,
      snapshot_links, snapshot_tags, snapshot_category_id, snapshot_category_label,
      original_author_id, snapshot_author_name, preview_asset_id)
      values (actor, p_plate_id, current_plate.revision, current_plate.body, current_plate.links,
        current_plate.tags, current_plate.category_id, category_label, author_key, author_name,
        p_preview_asset_id)
      on conflict (saver_id, plate_id) do nothing returning id into result;
    if result is null then
      select * into reminder from public.menu_plate_saves
        where saver_id = actor and plate_id = p_plate_id for update;
      if not found then raise exception 'Save raced; retry the whole transaction' using errcode = '40001'; end if;
      result := reminder.id;
      if p_preview_asset_id is not null and p_preview_asset_id is distinct from reminder.preview_asset_id then
        raise exception 'Saved preview cannot be changed' using errcode = '23514'; end if;
      if p_source_share_id is not null and reminder.availability <> 'available' then
        raise exception 'Cannot add a source to an unavailable reminder' using errcode = '42501'; end if;
    end if;
  end if;
  if p_source_share_id is not null then
    insert into public.menu_plate_sources(save_id, share_entry_id, plate_id)
      values (result, p_source_share_id, p_plate_id) on conflict (save_id, share_entry_id) do nothing;
  end if;
  return result;
end $$;

create or replace function public.request_menu_preview(p_plate_id uuid, p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id(); author_key uuid; current_plate public.plates%rowtype;
  first_asset uuid; existing_job uuid; fresh uuid;
begin
  select author_id into author_key from public.plates where id=p_plate_id;
  perform 1 from public.profiles where id in(actor,author_key) order by id for share;
  if actor is null or private.current_profile_id() is distinct from actor or not private.can_view_plate(p_plate_id) then
    raise exception 'Plate unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 7343102));
  select * into current_plate from public.plates where id = p_plate_id and availability = 'available' for share;
  if not found then raise exception 'Plate unavailable' using errcode = '42501'; end if;
  if p_expected_revision is distinct from current_plate.revision then
    raise exception 'Plate changed; refresh before saving' using errcode = '40001'; end if;
  if exists (select 1 from public.menu_plate_saves
      where saver_id = actor and plate_id = p_plate_id and availability = 'available') then
    raise exception 'Plate already saved' using errcode = '23514'; end if;
  select asset_id into first_asset from public.plate_media
    where plate_id = p_plate_id order by position limit 1;
  if first_asset is null then raise exception 'Plate has no photo preview to prepare' using errcode = '23514'; end if;
  select id into existing_job from public.menu_preview_jobs
    where saver_id = actor and plate_id = p_plate_id and source_asset_id = first_asset
      and source_revision = current_plate.revision and state in ('pending', 'processing', 'ready')
    order by created_at desc limit 1;
  if existing_job is not null then return existing_job; end if;
  if (select count(*) from public.menu_preview_jobs where saver_id = actor
      and state in ('pending', 'processing') and created_at > clock_timestamp() - interval '1 hour') >= 6 then
    raise exception 'Too many unfinished Menu previews; try again later' using errcode = '23514'; end if;
  if (select count(*) from public.menu_preview_jobs where saver_id = actor
      and created_at > clock_timestamp() - interval '1 hour') >= 12 then
    raise exception 'Menu preview limit reached for this hour' using errcode = '23514'; end if;
  if (select count(*) from public.menu_preview_jobs where saver_id = actor
      and created_at > clock_timestamp() - interval '1 day') >= 60 then
    raise exception 'Menu preview limit reached for today' using errcode = '23514'; end if;
  insert into public.menu_preview_jobs(saver_id, plate_id, source_asset_id, source_revision)
    values (actor, p_plate_id, first_asset, current_plate.revision) returning id into fresh;
  return fresh;
end $$;
create or replace function public.share_plate(p_group_id uuid,p_plate_id uuid,p_client_request_id uuid,
  p_body text default '',p_links jsonb default '[]',p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); author_key uuid;
begin
  select author_id into author_key from public.plates where id=p_plate_id;
  perform 1 from public.profiles where id in(actor,author_key) order by id for share;
  if actor is null or private.current_profile_id() is distinct from actor or not private.can_view_plate(p_plate_id) then
    raise exception 'Plate unavailable' using errcode='42501'; end if;
  return private.append_m2_entry(p_group_id,p_client_request_id,'plate_share',p_plate_id,p_body,p_links,p_attachment_ids);
end $$;
create function public.profile_bio(p_profile_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select bio from private.account_privacy where profile_id=p_profile_id and private.can_view_author(p_profile_id);
$$;
create function public.set_my_bio(p_bio text,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); settings_row private.account_privacy%rowtype;
begin
  perform 1 from public.profiles where id=actor and state='active' for update;
  if not found then raise exception 'Active account required' using errcode='42501'; end if;
  if p_bio is null or char_length(p_bio)>160 or p_expected_version is null then raise exception 'Use at most 160 characters' using errcode='23514'; end if;
  insert into private.account_privacy(profile_id) values(actor) on conflict do nothing;
  select * into settings_row from private.account_privacy where profile_id=actor for update;
  if settings_row.version=p_expected_version+1 and settings_row.bio=btrim(p_bio) then return; end if;
  if settings_row.version<>p_expected_version then raise exception 'Profile changed; refresh' using errcode='40001'; end if;
  if settings_row.bio=btrim(p_bio) then return; end if;
  update private.account_privacy set bio=btrim(p_bio),version=version+1 where profile_id=actor;
  perform private.bump_account(actor);
end $$;
revoke all on function public.profile_bio(uuid),public.set_my_bio(text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.profile_bio(uuid),public.set_my_bio(text,bigint) to authenticated;
create function public.social_counts() returns table(following bigint,followers bigint,requests bigint)
language sql stable security definer set search_path='' as $$
  select (select count(*) from private.follow_edges where follower_id=private.current_profile_id() and state='approved'),
    (select count(*) from private.follow_edges where author_id=private.current_profile_id() and state='approved'),
    (select count(*) from private.follow_edges where author_id=private.current_profile_id() and state='pending')
  where private.current_profile_id() is not null;
$$;
revoke all on function public.social_counts() from public,anon,authenticated,service_role;
grant execute on function public.social_counts() to authenticated;
create function private.social_plate_signal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.bump_account(new.author_id);
  perform private.bump_account(follower_id) from private.follow_edges where author_id=new.author_id and state='approved';
  return new;
end $$;
revoke all on function private.social_plate_signal() from public,anon,authenticated,service_role;
create trigger plates_social_signal after insert or update on public.plates for each row execute function private.social_plate_signal();
commit;
