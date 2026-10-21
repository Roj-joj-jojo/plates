-- M4a: private Plate image intake and immutable served images.
-- Additive local migration; no object or record cleanup is enabled.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run M4a with the local migration role postgres';
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit)
values ('staged-assets', 'staged-assets', false, 10000000),
       ('plate-media', 'plate-media', false, 10000000);

create table public.media_upload_intents (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  staged_path text not null unique,
  state text not null default 'pending' check (state in ('pending', 'processing', 'ready', 'failed')),
  asset_id uuid unique,
  error_message text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((state = 'ready') = (asset_id is not null)),
  check (state <> 'failed' or error_message is not null)
);
create index media_upload_intents_uploader on public.media_upload_intents(uploader_id, created_at desc);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  source_intent_id uuid not null unique references public.media_upload_intents(id) on update restrict on delete restrict,
  bucket_id text not null check (bucket_id = 'plate-media'),
  object_path text not null unique,
  media_type text not null check (media_type = 'image/webp'),
  width integer not null check (width between 1 and 2048),
  height integer not null check (height between 1 and 2048),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, uploader_id)
);
alter table public.media_upload_intents add constraint media_intent_asset_fk
  foreign key (asset_id) references public.media_assets(id) on update restrict on delete restrict;

create table public.plate_media (
  plate_id uuid not null references public.plates(id) on update restrict on delete restrict,
  asset_id uuid not null unique references public.media_assets(id) on update restrict on delete restrict,
  position integer not null check (position between 1 and 6),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (plate_id, asset_id),
  unique (plate_id, position) deferrable initially deferred
);
create index plate_media_plate_order on public.plate_media(plate_id, position);

alter table public.plates add column media_order_revision bigint not null default 0
  check (media_order_revision >= 0);

alter table public.media_upload_intents enable row level security;
alter table public.media_assets enable row level security;
alter table public.plate_media enable row level security;
create policy media_intents_own_read on public.media_upload_intents for select to authenticated
  using (uploader_id = (select private.current_profile_id()));
create policy media_assets_attached_read on public.media_assets for select to authenticated
  using (exists (select 1 from public.plate_media pm join public.plates p on p.id = pm.plate_id
    where pm.asset_id = media_assets.id and p.availability = 'available' and (select private.current_profile_id()) is not null));
create policy plate_media_available_read on public.plate_media for select to authenticated
  using (exists (select 1 from public.plates p where p.id = plate_id and p.availability = 'available'
    and (select private.current_profile_id()) is not null));
grant select (id, state, asset_id, error_message, created_at) on public.media_upload_intents to authenticated;
grant select (id, media_type, width, height) on public.media_assets to authenticated;
grant select (plate_id, asset_id, position) on public.plate_media to authenticated;
grant select, insert, update on public.media_upload_intents, public.media_assets, public.plate_media to service_role;
grant select (media_order_revision) on public.plates to authenticated;

create trigger media_intents_no_delete before delete on public.media_upload_intents for each row
  execute function private.reject_m2_delete();
create trigger media_assets_no_delete before delete on public.media_assets for each row
  execute function private.reject_m2_delete();
create trigger plate_media_no_delete before delete on public.plate_media for each row
  execute function private.reject_m2_delete();
create trigger media_assets_immutable before update on public.media_assets for each row
  execute function private.guard_record_update('id', 'uploader_id', 'source_intent_id', 'bucket_id',
    'object_path', 'media_type', 'width', 'height', 'created_at');
create trigger media_intents_immutable before update on public.media_upload_intents for each row
  execute function private.guard_record_update('id', 'uploader_id', 'staged_path', 'created_at');
create trigger plate_media_immutable before update on public.plate_media for each row
  execute function private.guard_record_update('plate_id', 'asset_id');

create function private.can_upload_staged_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.media_upload_intents i
    where i.staged_path = p_path and i.state = 'pending'
      and i.uploader_id = private.current_profile_id());
$$;
create function private.can_read_plate_object(p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'plate-media' and private.current_profile_id() is not null
    and exists (select 1 from public.media_assets a
      join public.plate_media pm on pm.asset_id = a.id
      join public.plates p on p.id = pm.plate_id
      where a.bucket_id = p_bucket and a.object_path = p_path
        and p.availability = 'available');
$$;
revoke all on function private.can_upload_staged_path(text),
  private.can_read_plate_object(text,text) from public, anon, authenticated, service_role;
grant execute on function private.can_upload_staged_path(text),
  private.can_read_plate_object(text,text) to authenticated;

-- A browser can only insert once at the random path issued to its own pending intent.
create policy plate_staged_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'staged-assets' and private.can_upload_staged_path(name));
-- Read only attached images. The worker uses a separate service credential.
create policy plate_media_object_read on storage.objects for select to authenticated
  using (bucket_id = 'plate-media'
    and storage.allow_any_operation(array['object.get_authenticated', 'object.sign'])
    and private.can_read_plate_object(bucket_id, name));

create function public.request_plate_upload()
returns table(intent_id uuid, staged_path text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fresh uuid := gen_random_uuid();
begin
  if (select count(*) from public.media_upload_intents
      where uploader_id = actor and state = 'pending' and created_at > clock_timestamp() - interval '1 hour') >= 12 then
    raise exception 'Too many pending images; try again later' using errcode = '23514';
  end if;
  insert into public.media_upload_intents(id, uploader_id, staged_path)
    values (fresh, actor, actor::text || '/' || fresh::text)
    returning id, media_upload_intents.staged_path into intent_id, staged_path;
  return next;
end $$;
revoke all on function public.request_plate_upload() from public, anon, authenticated, service_role;
grant execute on function public.request_plate_upload() to authenticated;

-- The media process alone uses service_role. Browser roles have no write grant.
create function public.finish_plate_upload(p_intent_id uuid, p_asset_id uuid,
  p_object_path text, p_width integer, p_height integer)
returns void language plpgsql security definer set search_path = '' as $$
declare intent public.media_upload_intents%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501';
  end if;
  select * into intent from public.media_upload_intents where id = p_intent_id for update;
  if not found or intent.state <> 'processing' then
    raise exception 'Upload intent unavailable' using errcode = '23514';
  end if;
  if p_object_path is distinct from p_asset_id::text || '.webp' then
    raise exception 'Invalid media path' using errcode = '23514';
  end if;
  insert into public.media_assets(id, uploader_id, source_intent_id, bucket_id,
    object_path, media_type, width, height)
    values (p_asset_id, intent.uploader_id, intent.id, 'plate-media', p_object_path,
      'image/webp', p_width, p_height);
  update public.media_upload_intents set state = 'ready', asset_id = p_asset_id,
    updated_at = clock_timestamp() where id = p_intent_id;
end $$;
create function public.fail_plate_upload(p_intent_id uuid, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501';
  end if;
  update public.media_upload_intents set state = 'failed',
    error_message = left(coalesce(p_message, 'Image processing failed'), 200),
    updated_at = clock_timestamp() where id = p_intent_id and state = 'processing';
end $$;
revoke all on function public.finish_plate_upload(uuid,uuid,text,integer,integer),
  public.fail_plate_upload(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.finish_plate_upload(uuid,uuid,text,integer,integer),
  public.fail_plate_upload(uuid,text) to service_role;

create function public.plate_image_locations(p_plate_id uuid)
returns table(asset_id uuid, object_path text, width integer, height integer, image_position integer)
language sql stable security definer set search_path = '' as $$
  select a.id, a.object_path, a.width, a.height, pm.position
    from public.plates p
    join public.plate_media pm on pm.plate_id = p.id
    join public.media_assets a on a.id = pm.asset_id
    where p.id = p_plate_id and p.availability = 'available'
      and private.current_profile_id() is not null
    order by pm.position;
$$;
revoke all on function public.plate_image_locations(uuid) from public, anon, authenticated, service_role;
grant execute on function public.plate_image_locations(uuid) to authenticated;

create or replace function private.guard_plate_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.revision <> 1 or new.media_order_revision <> 0 then
      raise exception 'Initial revision must be 1' using errcode = '23514'; end if;
  else
    if new.revision <> old.revision or new.media_order_revision < old.media_order_revision
      or new.media_order_revision > old.media_order_revision + 1 then
      raise exception 'Revision is server-owned' using errcode = '23514'; end if;
    if row(new.body, new.links, new.tags, new.category_id, new.availability, new.media_order_revision)
      is distinct from row(old.body, old.links, old.tags, old.category_id, old.availability, old.media_order_revision) then
      new.revision := old.revision + 1;
    end if;
  end if;
  return new;
end $$;

create or replace function private.check_m2_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare valid boolean; plate_key uuid;
begin
  if tg_table_name = 'plate_media' then plate_key := new.plate_id;
  elsif tg_table_name = 'plates' then plate_key := new.id;
  end if;
  if plate_key is not null then
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      or exists (select 1 from public.plate_media where plate_id = plate_key)
      into valid from public.plates where id = plate_key;
  elsif tg_table_name = 'timeline_entries' then
    select availability <> 'available' or kind = 'plate_share' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      into valid from public.timeline_entries where id = new.id;
  else
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      into valid from public.thread_replies where id = new.id;
  end if;
  if valid is distinct from true then
    raise exception 'Available content requires text, a link or a Plate image' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger plate_media_content after insert or update on public.plate_media
  deferrable initially deferred for each row execute function private.check_m2_content();

create function private.validate_plate_images(p_ids uuid[], p_actor uuid, p_current_plate uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare image_id uuid; existing_plate uuid; asset_count integer := 0;
begin
  if p_ids is null or cardinality(p_ids) > 6 then
    raise exception 'Choose at most six images' using errcode = '23514'; end if;
  foreach image_id in array p_ids loop
    asset_count := asset_count + 1;
    if image_id = any(p_ids[1:asset_count-1]) then
      raise exception 'Duplicate image' using errcode = '23514'; end if;
    perform 1 from public.media_assets where id = image_id and uploader_id = p_actor
      and bucket_id = 'plate-media' for share;
    if not found then raise exception 'Image not ready for this Plate' using errcode = '23514'; end if;
    select plate_id into existing_plate from public.plate_media where asset_id = image_id;
    if existing_plate is not null and existing_plate is distinct from p_current_plate then
      raise exception 'Image is already attached' using errcode = '23514'; end if;
  end loop;
end $$;

create or replace function public.publish_plate(p_category_id uuid, p_body text default '', p_links jsonb default '[]',
  p_tags jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); result uuid; image_id uuid; pos integer;
begin
  perform private.validate_m2_input(p_body, p_links, '{}', true);
  if p_body !~ '[^[:space:]]' and jsonb_array_length(p_links) = 0
    and cardinality(p_attachment_ids) = 0 then
    raise exception 'Plate needs text, a link or an image' using errcode = '23514'; end if;
  perform private.validate_plate_images(p_attachment_ids, actor);
  perform 1 from public.categories where id = p_category_id for share;
  if not found then raise exception 'Choose a valid category' using errcode = '23514'; end if;
  insert into public.plates(author_id, category_id, body, links, tags)
    values (actor, p_category_id, p_body, p_links, private.canonical_tags(p_tags)) returning id into result;
  for image_id, pos in select id, ordinality::integer from unnest(p_attachment_ids) with ordinality as t(id, ordinality) loop
    insert into public.plate_media(plate_id, asset_id, position) values (result, image_id, pos);
  end loop;
  return result;
end $$;

create or replace function public.edit_plate(p_plate_id uuid, p_expected_revision bigint, p_category_id uuid,
  p_body text, p_links jsonb default '[]', p_tags jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); current_plate public.plates%rowtype;
  result bigint; image_id uuid; pos integer; media_changed boolean;
begin
  select * into current_plate from public.plates where id = p_plate_id and author_id = actor
    and availability = 'available' for update;
  if not found then raise exception 'Plate not available for editing' using errcode = '42501'; end if;
  if p_expected_revision is distinct from current_plate.revision then
    raise exception 'Plate changed; refresh before editing' using errcode = '40001'; end if;
  perform private.validate_m2_input(p_body, p_links, '{}', true);
  if p_body !~ '[^[:space:]]' and jsonb_array_length(p_links) = 0
    and cardinality(p_attachment_ids) = 0 then
    raise exception 'Plate needs text, a link or an image' using errcode = '23514'; end if;
  perform private.validate_plate_images(p_attachment_ids, actor, p_plate_id);
  if exists (select 1 from public.plate_media where plate_id = p_plate_id
      and asset_id <> all(p_attachment_ids)) then
    raise exception 'Removing images is not enabled yet' using errcode = '23514'; end if;
  select count(*) <> cardinality(p_attachment_ids)
    or exists (select 1 from public.plate_media pm
      join unnest(p_attachment_ids) with ordinality as x(id, pos) on pm.asset_id = x.id
      where pm.plate_id = p_plate_id and pm.position <> x.pos)
    into media_changed from public.plate_media where plate_id = p_plate_id;
  perform 1 from public.categories where id = p_category_id for share;
  if not found then raise exception 'Choose a valid category' using errcode = '23514'; end if;
  for image_id, pos in select id, ordinality::integer from unnest(p_attachment_ids) with ordinality as t(id, ordinality) loop
    insert into public.plate_media(plate_id, asset_id, position) values (p_plate_id, image_id, pos)
      on conflict (plate_id, asset_id) do update set position = excluded.position;
  end loop;
  update public.plates set category_id = p_category_id, body = p_body, links = p_links,
    tags = private.canonical_tags(p_tags),
    media_order_revision = media_order_revision + case when media_changed then 1 else 0 end
    where id = p_plate_id returning revision into result;
  return result;
end $$;

commit;
