-- M3: immutable text/link Menu reminders and explicitly retained discussions.
-- Additive. No media, unsave, source removal or erasure operation is enabled.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run M3 with the local migration role postgres';
  end if;
end $$;

create table public.menu_plate_saves (
  id uuid primary key default gen_random_uuid(),
  saver_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  plate_id uuid not null references public.plates(id) on update restrict on delete restrict,
  saved_at timestamptz not null default clock_timestamp(),
  snapshot_revision bigint not null check (snapshot_revision > 0),
  availability text not null default 'available' check (availability in ('available', 'erased')),
  snapshot_body text not null check (char_length(snapshot_body) <= 20000),
  snapshot_links jsonb not null check (private.valid_content_links(snapshot_links)),
  snapshot_tags jsonb not null check (snapshot_tags = private.canonical_tags(snapshot_tags)),
  snapshot_category_id uuid references public.categories(id) on update restrict on delete restrict,
  snapshot_category_label text not null,
  original_author_id uuid references public.profiles(id) on update restrict on delete restrict,
  snapshot_author_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (saver_id, plate_id), unique (id, plate_id),
  check (isfinite(saved_at)),
  constraint menu_snapshot_attribution check (
    availability <> 'available' or (
      snapshot_category_id is not null and snapshot_category_label ~ '[^[:space:]]'
      and original_author_id is not null and char_length(snapshot_author_name) between 1 and 80
      and snapshot_author_name !~ '^[[:space:]]|[[:space:]]$'
      and snapshot_author_name !~ '[[:cntrl:]]'
    )
  ),
  constraint erased_menu_is_blank check (
    availability <> 'erased' or (snapshot_body = '' and snapshot_links = '[]' and snapshot_tags = '[]'
      and snapshot_category_id is null and snapshot_category_label = ''
      and original_author_id is null and snapshot_author_name = '')
  )
);
create index menu_saves_plate on public.menu_plate_saves(plate_id);
create index menu_saves_author on public.menu_plate_saves(original_author_id);
create index menu_saves_category on public.menu_plate_saves(snapshot_category_id);
create index menu_saves_owner_time on public.menu_plate_saves(saver_id, saved_at desc, id);

create table public.menu_plate_sources (
  save_id uuid not null,
  share_entry_id uuid not null,
  plate_id uuid not null,
  added_at timestamptz not null default clock_timestamp() check (isfinite(added_at)),
  primary key (save_id, share_entry_id),
  foreign key (save_id, plate_id) references public.menu_plate_saves(id, plate_id)
    on update restrict on delete restrict,
  foreign key (share_entry_id, plate_id) references public.plate_shares(entry_id, plate_id)
    on update restrict on delete restrict
);
create index menu_sources_share on public.menu_plate_sources(share_entry_id, plate_id);

revoke all on public.menu_plate_saves, public.menu_plate_sources from public, anon, authenticated, service_role;
alter table public.menu_plate_saves enable row level security;
alter table public.menu_plate_sources enable row level security;
create policy menu_saves_owner_read on public.menu_plate_saves for select to authenticated
  using (saver_id = (select private.current_profile_id()));
create policy menu_sources_owner_read on public.menu_plate_sources for select to authenticated
  using (exists (select 1 from public.menu_plate_saves s where s.id = save_id and s.availability = 'available'));
grant select (id, saver_id, plate_id, saved_at, snapshot_revision, availability,
  snapshot_body, snapshot_links, snapshot_tags, snapshot_category_id, snapshot_category_label,
  original_author_id, snapshot_author_name, created_at, updated_at)
  on public.menu_plate_saves to authenticated;
grant select (save_id, share_entry_id, plate_id, added_at) on public.menu_plate_sources to authenticated;

-- Keep only the saver-owned reference when the root's RLS excludes this caller.
-- Never resolve group/sharer information using privileged joins or copied labels.
create view public.menu_source_context with (security_invoker = true) as
  select s.save_id, s.share_entry_id, s.plate_id, s.added_at,
    e.group_id, g.name as group_name, e.author_id as sharer_id,
    p.display_name as sharer_name, e.body as introduction, e.links as introduction_links,
    t.id as thread_id, (t.id is not null) as source_available
  from public.menu_plate_sources s
  left join public.timeline_entries e on e.id = s.share_entry_id and e.availability = 'available'
  left join public.groups g on g.id = e.group_id
  left join public.profiles p on p.id = e.author_id
  left join public.threads t on t.root_entry_id = e.id and t.group_id = e.group_id;
revoke all on public.menu_source_context from public, anon, authenticated, service_role;
grant select on public.menu_source_context to authenticated;

-- Snapshot content may be blanked only by a future reviewed M6 operation, which
-- must replace these guards and erase preview derivatives too. No refresh path.
create trigger menu_saves_immutable before update on public.menu_plate_saves for each row
  execute function private.guard_record_update('id', 'saver_id', 'plate_id', 'saved_at',
    'snapshot_revision', 'availability', 'snapshot_body', 'snapshot_links', 'snapshot_tags',
    'snapshot_category_id', 'snapshot_category_label', 'original_author_id', 'snapshot_author_name', 'created_at');
create function private.guard_menu_source_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new is distinct from old then
    raise exception 'Saved source identity and time are immutable' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger menu_sources_immutable before update on public.menu_plate_sources for each row
  execute function private.guard_menu_source_update();

create function private.check_menu_snapshot_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare valid boolean;
begin
  select availability <> 'available' or snapshot_body ~ '[^[:space:]]' or jsonb_array_length(snapshot_links) > 0
    into valid from public.menu_plate_saves where id = new.id;
  if valid is distinct from true then
    raise exception 'Saved reminder requires text or a link; previews are not enabled yet' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger menu_snapshot_content after insert or update on public.menu_plate_saves
  deferrable initially deferred for each row execute function private.check_menu_snapshot_content();
create function private.reject_menu_delete()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Menu removal is not enabled yet' using errcode = '23514'; end $$;
create trigger menu_saves_no_delete before delete on public.menu_plate_saves for each row
  execute function private.reject_menu_delete();
create trigger menu_sources_no_delete before delete on public.menu_plate_sources for each row
  execute function private.reject_menu_delete();

-- Called only AFTER caller profile guards and BEFORE the Plate guard.
-- Parent IDs are immutable; mutable availability/membership is rechecked under S.
create function private.lock_menu_source(p_share_entry_id uuid, p_plate_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare group_key uuid;
begin
  select e.group_id into group_key from public.plate_shares s
    join public.timeline_entries e on e.id = s.entry_id
    where s.entry_id = p_share_entry_id and s.plate_id = p_plate_id;
  if not found then raise exception 'Source is unavailable for this Plate' using errcode = '42501'; end if;
  perform 1 from public.groups where id = group_key and availability = 'available' for share;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Source is unavailable for this Plate' using errcode = '42501';
  end if;
  perform 1 from public.plate_shares s join public.timeline_entries e on e.id = s.entry_id
    where s.entry_id = p_share_entry_id and s.plate_id = p_plate_id
      and e.group_id = group_key and e.availability = 'available';
  if not found then raise exception 'Source is unavailable for this Plate' using errcode = '42501'; end if;
end $$;

create function public.save_plate(p_plate_id uuid, p_expected_revision bigint,
  p_source_share_id uuid default null, p_preview_asset_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id(); author_key uuid;
  current_plate public.plates%rowtype; reminder public.menu_plate_saves%rowtype;
  author_name text; category_label text; result uuid;
begin
  if actor is null then raise exception 'Active sign-in required' using errcode = '42501'; end if;
  if p_preview_asset_id is not null then
    raise exception 'Menu previews are not enabled yet' using errcode = '23514';
  end if;
  -- Discover author first; do not pre-lock the saver out of UUID order.
  select author_id into author_key from public.plates where id = p_plate_id;
  if not found then raise exception 'Plate unavailable' using errcode = '42501'; end if;
  perform 1 from public.profiles where id in (actor, author_key) order by id for share;
  if private.current_profile_id() is distinct from actor then
    raise exception 'Active sign-in required' using errcode = '42501';
  end if;
  if p_source_share_id is not null then perform private.lock_menu_source(p_source_share_id, p_plate_id); end if;
  select * into current_plate from public.plates where id = p_plate_id for share;
  if not found or current_plate.author_id is distinct from author_key then
    raise exception 'Plate unavailable' using errcode = '42501';
  end if;
  -- Keep category before Menu locks, including repeat-save paths.
  select label into category_label from public.categories where id = current_plate.category_id for share;
  select * into reminder from public.menu_plate_saves where saver_id = actor and plate_id = p_plate_id for update;
  if found then
    result := reminder.id;
    if p_source_share_id is not null and
      (reminder.availability <> 'available' or current_plate.availability <> 'available') then
      raise exception 'Cannot add a source to an unavailable Plate or reminder' using errcode = '42501';
    end if;
    -- Intentionally do not validate expected_revision or rewrite any snapshot.
  else
    if current_plate.availability <> 'available' then raise exception 'Plate unavailable' using errcode = '42501'; end if;
    if p_expected_revision is distinct from current_plate.revision then
      raise exception 'Plate changed; refresh before first save' using errcode = '40001';
    end if;
    select display_name into author_name from public.profiles where id = author_key;
    if author_name is null or category_label is null then
      raise exception 'Plate attribution unavailable' using errcode = '42501';
    end if;
    insert into public.menu_plate_saves(saver_id, plate_id, snapshot_revision, snapshot_body,
      snapshot_links, snapshot_tags, snapshot_category_id, snapshot_category_label,
      original_author_id, snapshot_author_name)
      values (actor, p_plate_id, current_plate.revision, current_plate.body, current_plate.links,
        current_plate.tags, current_plate.category_id, category_label, author_key, author_name)
      on conflict (saver_id, plate_id) do nothing returning id into result;
    if result is null then
      -- A competing first save can win after the earlier SELECT snapshot.
      -- A separate statement sees that winner at READ COMMITTED; never upsert.
      select * into reminder from public.menu_plate_saves
        where saver_id = actor and plate_id = p_plate_id for update;
      if not found then raise exception 'Save raced; retry the whole transaction' using errcode = '40001'; end if;
      result := reminder.id;
      if p_source_share_id is not null and reminder.availability <> 'available' then
        raise exception 'Cannot add a source to an unavailable reminder' using errcode = '42501';
      end if;
    end if;
  end if;
  if p_source_share_id is not null then
    insert into public.menu_plate_sources(save_id, share_entry_id, plate_id)
      values (result, p_source_share_id, p_plate_id) on conflict (save_id, share_entry_id) do nothing;
  end if;
  return result;
end $$;

create function public.add_menu_source(p_save_id uuid, p_source_share_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); plate_key uuid;
begin
  select plate_id into plate_key from public.menu_plate_saves
    where id = p_save_id and saver_id = actor and availability = 'available';
  if not found then raise exception 'Reminder unavailable' using errcode = '42501'; end if;
  perform private.lock_menu_source(p_source_share_id, plate_key);
  perform 1 from public.plates where id = plate_key and availability = 'available' for share;
  if not found then raise exception 'Plate unavailable for adding a source' using errcode = '42501'; end if;
  perform 1 from public.menu_plate_saves where id = p_save_id and plate_id = plate_key
    and saver_id = actor and availability = 'available' for update;
  if not found then raise exception 'Reminder unavailable' using errcode = '42501'; end if;
  insert into public.menu_plate_sources(save_id, share_entry_id, plate_id)
    values (p_save_id, p_source_share_id, plate_key) on conflict (save_id, share_entry_id) do nothing;
  return p_save_id;
end $$;

revoke all on function private.guard_menu_source_update(), private.check_menu_snapshot_content(),
  private.reject_menu_delete(), private.lock_menu_source(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.save_plate(uuid,bigint,uuid,uuid), public.add_menu_source(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.save_plate(uuid,bigint,uuid,uuid), public.add_menu_source(uuid,uuid) to authenticated;
commit;
