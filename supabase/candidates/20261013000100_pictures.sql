-- Candidate only: not applied. Reuses processed private media, never public URLs.
begin;

create table private.picture_claims (
  asset_id uuid primary key references public.media_assets(id) on delete restrict,
  kind text not null check (kind in ('profile','table')),
  target_id uuid not null
);
create table private.profile_pictures (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  asset_id uuid unique references public.media_assets(id) on delete restrict,
  version bigint not null default 0 check (version >= 0)
);
create table private.table_pictures (
  group_id uuid primary key references public.groups(id) on delete restrict,
  asset_id uuid unique references public.media_assets(id) on delete restrict,
  version bigint not null default 0 check (version >= 0)
);
create table private.picture_cleanup (
  asset_id uuid primary key references public.media_assets(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','processing','removed')),
  updated_at timestamptz not null default clock_timestamp()
);
revoke all on private.picture_claims,private.profile_pictures,private.table_pictures,private.picture_cleanup
  from public,anon,authenticated,service_role;

create function public.pictures_ready() returns boolean language sql stable as $$ select true $$;
create function private.picture_visible(p_kind text,p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.current_profile_id() is not null and case p_kind
    when 'profile' then exists(select 1 from public.profiles where id=p_target and state='active')
      and private.can_read_profile(p_target)
    when 'table' then private.is_active_member(p_target)
      and exists(select 1 from public.groups where id=p_target and availability='available')
    else false end;
$$;
create function public.picture_locations(p_kind text,p_ids uuid[])
returns table(target_id uuid,asset_id uuid,object_path text,version bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_profile_id() is null or p_ids is null or cardinality(p_ids)>100
    or p_kind is null or p_kind not in ('profile','table') then
    raise exception 'Active account and valid picture scope required' using errcode='42501';
  end if;
  if p_kind='profile' then
    return query select p.id,a.id,a.object_path,coalesce(pic.version,0)
      from public.profiles p left join private.profile_pictures pic on pic.profile_id=p.id
      left join public.media_assets a on a.id=pic.asset_id
      where p.id=any(p_ids) and private.picture_visible('profile',p.id);
  else
    return query select g.id,a.id,a.object_path,coalesce(pic.version,0)
      from public.groups g left join private.table_pictures pic on pic.group_id=g.id
      left join public.media_assets a on a.id=pic.asset_id
      where g.id=any(p_ids) and private.picture_visible('table',g.id);
  end if;
end $$;
create function private.can_read_picture_object(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.media_assets a
    join public.profiles owner on owner.id=a.uploader_id and owner.state='active'
    where a.object_path=p_path and (
      exists(select 1 from private.profile_pictures p where p.asset_id=a.id
        and private.picture_visible('profile',p.profile_id))
      or exists(select 1 from private.table_pictures g where g.asset_id=a.id
        and private.picture_visible('table',g.group_id))));
$$;
create policy picture_object_read on storage.objects for select to authenticated
  using (bucket_id='plate-media'
    and storage.allow_any_operation(array['object.get_authenticated','object.sign'])
    and private.can_read_picture_object(name));

create function private.retire_picture() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.asset_id is not null and old.asset_id is distinct from new.asset_id then
    insert into private.picture_cleanup(asset_id) values(old.asset_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger profile_picture_retirement after update on private.profile_pictures
  for each row execute function private.retire_picture();
create trigger table_picture_retirement after update on private.table_pictures
  for each row execute function private.retire_picture();

create function public.set_picture(p_kind text,p_target_id uuid,p_asset_id uuid,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.lock_content_actor(); current_asset uuid; current_version bigint;
begin
  if p_kind is null or p_kind not in ('profile','table') or p_target_id is null
    or p_expected_version is null or p_expected_version<0 then
    raise exception 'Valid picture scope required' using errcode='23514';
  end if;
  -- Serialize missing-row inserts as well as edits, without upgrading shared profile locks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_kind||p_target_id::text,7343102));
  if p_kind='profile' then
    if actor<>p_target_id then raise exception 'Only your own picture can be changed' using errcode='42501'; end if;
    insert into private.profile_pictures(profile_id) values(actor) on conflict do nothing;
    select asset_id,version into current_asset,current_version from private.profile_pictures
      where profile_id=actor for update;
  else
    perform 1 from public.groups where id=p_target_id and availability='available' for update;
    if not found or not private.is_group_owner(p_target_id) then
      raise exception 'Table Admin required' using errcode='42501';
    end if;
    insert into private.table_pictures(group_id) values(p_target_id) on conflict do nothing;
    select asset_id,version into current_asset,current_version from private.table_pictures
      where group_id=p_target_id for update;
  end if;
  -- A retry of an already accepted operation never increments the version again.
  if current_version=p_expected_version+1 and current_asset is not distinct from p_asset_id then
    return current_version;
  end if;
  if current_version<>p_expected_version then
    raise exception 'Picture changed elsewhere. Reload before trying again' using errcode='40001';
  end if;
  if current_asset is not distinct from p_asset_id then return current_version; end if;
  if p_asset_id is not null then
    perform 1 from public.media_assets where id=p_asset_id and uploader_id=actor for update;
    if not found or exists(select 1 from public.plate_media where asset_id=p_asset_id)
      or exists(select 1 from private.picture_claims where asset_id=p_asset_id) then
      raise exception 'Use a new photo uploaded by this account' using errcode='23514';
    end if;
    insert into private.picture_claims(asset_id,kind,target_id) values(p_asset_id,p_kind,p_target_id);
  end if;
  if p_kind='profile' then
    update private.profile_pictures set asset_id=p_asset_id,version=version+1 where profile_id=actor;
  else
    update private.table_pictures set asset_id=p_asset_id,version=version+1 where group_id=p_target_id;
  end if;
  return current_version+1;
end $$;

-- A picture cannot later be attached to a Plate and bypass picture visibility/cleanup.
create function private.guard_picture_plate_attachment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.media_assets where id=new.asset_id for update;
  if exists(select 1 from private.picture_claims where asset_id=new.asset_id) then
    raise exception 'Picture assets cannot be attached to Plates' using errcode='23514';
  end if;
  return new;
end $$;
create trigger plate_media_picture_guard before insert on public.plate_media
  for each row execute function private.guard_picture_plate_attachment();

create function private.clear_unavailable_pictures() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='profiles' then
    if new.state<>'active' then
      update private.profile_pictures set asset_id=null,version=version+1
        where profile_id=new.id and asset_id is not null;
      update private.table_pictures set asset_id=null,version=version+1 where asset_id in
        (select id from public.media_assets where uploader_id=new.id);
    end if;
  elsif new.availability<>'available' then
    update private.table_pictures set asset_id=null,version=version+1
      where group_id=new.id and asset_id is not null;
  end if;
  return new;
end $$;
create trigger profiles_clear_pictures after update of state on public.profiles
  for each row execute function private.clear_unavailable_pictures();
create trigger groups_clear_pictures after update of availability on public.groups
  for each row execute function private.clear_unavailable_pictures();

create function public.claim_picture_cleanup(p_profile_id uuid default null)
returns table(asset_id uuid,object_path text,staged_path text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode='42501';
  end if;
  return query with chosen as (
    select q.asset_id from private.picture_cleanup q join public.media_assets a on a.id=q.asset_id
      where (q.state='pending' or (q.state='processing' and q.updated_at<clock_timestamp()-interval '2 minutes'))
        and (p_profile_id is null or a.uploader_id=p_profile_id)
        and not exists(select 1 from private.profile_pictures p where p.asset_id=a.id)
        and not exists(select 1 from private.table_pictures g where g.asset_id=a.id)
        and not exists(select 1 from public.plate_media p where p.asset_id=a.id)
      order by q.updated_at limit 20 for update of q skip locked
  ), claimed as (
    update private.picture_cleanup q set state='processing',updated_at=clock_timestamp()
      from chosen c where q.asset_id=c.asset_id returning q.asset_id
  ) select a.id,a.object_path,i.staged_path from claimed c join public.media_assets a on a.id=c.asset_id
      join public.media_upload_intents i on i.id=a.source_intent_id;
end $$;
create function public.finish_picture_cleanup(p_asset_id uuid,p_ok boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode='42501';
  end if;
  update private.picture_cleanup set state=case when p_ok then 'removed' else 'pending' end,
    updated_at=clock_timestamp() where asset_id=p_asset_id and state='processing';
end $$;
create function private.require_picture_erasure_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state in ('auth_pending','complete') and exists(
    select 1 from private.picture_cleanup q join public.media_assets a on a.id=q.asset_id
      where a.uploader_id=new.profile_id and q.state<>'removed') then
    raise exception 'Picture cleanup is incomplete' using errcode='23514';
  end if;
  return new;
end $$;
create trigger erasure_picture_cleanup before update of state on private.account_erasure_jobs
  for each row execute function private.require_picture_erasure_cleanup();

revoke all on function public.pictures_ready(),public.picture_locations(text,uuid[]),public.set_picture(text,uuid,uuid,bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.pictures_ready(),public.picture_locations(text,uuid[]),public.set_picture(text,uuid,uuid,bigint) to authenticated;
revoke all on function public.claim_picture_cleanup(uuid),public.finish_picture_cleanup(uuid,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.claim_picture_cleanup(uuid),public.finish_picture_cleanup(uuid,boolean) to service_role;
revoke all on function private.picture_visible(text,uuid),private.can_read_picture_object(text),
  private.retire_picture(),private.guard_picture_plate_attachment(),private.clear_unavailable_pictures(),
  private.require_picture_erasure_cleanup() from public,anon,authenticated,service_role;
grant execute on function private.can_read_picture_object(text) to authenticated;
commit;
