-- M4c: private Table message and reply photos. Additive; no cleanup is enabled.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run M4c with the local migration role postgres';
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit)
  values ('table-staged-assets', 'table-staged-assets', false, 10000000),
         ('table-media', 'table-media', false, 10000000);

create table public.table_upload_intents (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  group_id uuid not null references public.groups(id) on update restrict on delete restrict,
  staged_path text not null unique,
  state text not null default 'pending' check (state in ('pending', 'processing', 'ready', 'failed')),
  asset_id uuid unique,
  error_message text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((state = 'ready') = (asset_id is not null)),
  check (state <> 'failed' or error_message is not null)
);
create index table_upload_intents_uploader on public.table_upload_intents(uploader_id, created_at desc);
create index table_upload_intents_pending on public.table_upload_intents(created_at) where state = 'pending';

create table public.table_media_assets (
  id uuid primary key,
  uploader_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  group_id uuid not null references public.groups(id) on update restrict on delete restrict,
  source_intent_id uuid not null unique references public.table_upload_intents(id) on update restrict on delete restrict,
  bucket_id text not null check (bucket_id = 'table-media'),
  object_path text not null unique,
  media_type text not null check (media_type = 'image/webp'),
  width integer not null check (width between 1 and 2048),
  height integer not null check (height between 1 and 2048),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.table_upload_intents add constraint table_intent_asset_fk
  foreign key (asset_id) references public.table_media_assets(id) on update restrict on delete restrict;

create table public.entry_media (
  entry_id uuid not null,
  group_id uuid not null,
  kind text not null default 'message' check (kind = 'message'),
  asset_id uuid not null unique references public.table_media_assets(id) on update restrict on delete restrict,
  position integer not null check (position between 1 and 4),
  created_at timestamptz not null default clock_timestamp(),
  primary key (entry_id, asset_id),
  unique (entry_id, position) deferrable initially deferred,
  foreign key (entry_id, group_id, kind) references public.timeline_entries(id, group_id, kind)
    on update restrict on delete restrict
);
create index entry_media_group on public.entry_media(group_id, entry_id);
create table public.reply_media (
  reply_id uuid not null references public.thread_replies(id) on update restrict on delete restrict,
  asset_id uuid not null unique references public.table_media_assets(id) on update restrict on delete restrict,
  position integer not null check (position between 1 and 4),
  created_at timestamptz not null default clock_timestamp(),
  primary key (reply_id, asset_id),
  unique (reply_id, position) deferrable initially deferred
);
create index reply_media_reply on public.reply_media(reply_id, position);

alter table public.table_upload_intents enable row level security;
alter table public.table_media_assets enable row level security;
alter table public.entry_media enable row level security;
alter table public.reply_media enable row level security;
create policy table_intents_own_read on public.table_upload_intents for select to authenticated
  using (uploader_id = (select private.current_profile_id()));
create policy table_assets_attached_read on public.table_media_assets for select to authenticated
  using (private.is_active_member(group_id) and (
    exists (select 1 from public.entry_media em join public.timeline_entries e on e.id = em.entry_id
      where em.asset_id = table_media_assets.id and e.availability = 'available')
    or exists (select 1 from public.reply_media rm join public.thread_replies r on r.id = rm.reply_id
      where rm.asset_id = table_media_assets.id and r.availability = 'available')));
create policy entry_media_member_read on public.entry_media for select to authenticated
  using (private.is_active_member(group_id) and exists
    (select 1 from public.timeline_entries e where e.id = entry_id and e.availability = 'available'));
create policy reply_media_member_read on public.reply_media for select to authenticated
  using (exists (select 1 from public.thread_replies r where r.id = reply_id
    and r.availability = 'available' and private.is_active_member(r.group_id)));
grant select (id, state, asset_id, error_message, created_at) on public.table_upload_intents to authenticated;
grant select (id, media_type, width, height) on public.table_media_assets to authenticated;
grant select (entry_id, group_id, asset_id, position) on public.entry_media to authenticated;
grant select (reply_id, asset_id, position) on public.reply_media to authenticated;
grant select, insert, update on public.table_upload_intents, public.table_media_assets to service_role;

create trigger table_intents_no_delete before delete on public.table_upload_intents for each row
  execute function private.reject_m2_delete();
create trigger table_assets_no_delete before delete on public.table_media_assets for each row
  execute function private.reject_m2_delete();
create trigger entry_media_no_delete before delete on public.entry_media for each row
  execute function private.reject_m2_delete();
create trigger reply_media_no_delete before delete on public.reply_media for each row
  execute function private.reject_m2_delete();
create trigger table_intents_immutable before update on public.table_upload_intents for each row
  execute function private.guard_record_update('id', 'uploader_id', 'group_id', 'staged_path', 'created_at');
create trigger table_assets_immutable before update on public.table_media_assets for each row
  execute function private.guard_record_update('id', 'uploader_id', 'group_id', 'source_intent_id',
    'bucket_id', 'object_path', 'media_type', 'width', 'height', 'created_at');
create trigger entry_media_immutable before update on public.entry_media for each row
  execute function private.guard_record_update('entry_id', 'group_id', 'kind', 'asset_id', 'position', 'created_at');
create trigger reply_media_immutable before update on public.reply_media for each row
  execute function private.guard_record_update('reply_id', 'asset_id', 'position', 'created_at');

create function private.can_upload_table_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.table_upload_intents i
    where i.staged_path = p_path and i.state = 'pending'
      and i.uploader_id = private.current_profile_id() and private.is_active_member(i.group_id));
$$;
create function private.can_read_table_object(p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'table-media' and exists (
    select 1 from public.table_media_assets a where a.bucket_id = p_bucket
      and a.object_path = p_path and private.is_active_member(a.group_id)
      and (exists (select 1 from public.entry_media em
        join public.timeline_entries e on e.id = em.entry_id
        where em.asset_id = a.id and e.availability = 'available')
        or exists (select 1 from public.reply_media rm
          join public.thread_replies r on r.id = rm.reply_id
          where rm.asset_id = a.id and r.availability = 'available')));
$$;
revoke all on function private.can_upload_table_path(text), private.can_read_table_object(text,text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_upload_table_path(text),
  private.can_read_table_object(text,text) to authenticated;
create policy table_staged_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'table-staged-assets' and private.can_upload_table_path(name));
create policy table_media_object_read on storage.objects for select to authenticated
  using (bucket_id = 'table-media'
    and storage.allow_any_operation(array['object.get_authenticated', 'object.sign'])
    and private.can_read_table_object(bucket_id, name));

-- Plate and Table attempts share the existing per-account resource budget.
create function private.check_photo_upload_quota(p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare checked_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text, 7343101));
  checked_at := clock_timestamp();
  if ((select count(*) from public.media_upload_intents
      where uploader_id = p_actor and created_at > checked_at - interval '24 hours')
    + (select count(*) from public.table_upload_intents
      where uploader_id = p_actor and created_at > checked_at - interval '24 hours')) >= 60 then
    raise exception 'Daily photo limit reached. Try again tomorrow' using errcode = 'P0001'; end if;
  if ((select count(*) from public.media_upload_intents
      where uploader_id = p_actor and created_at > checked_at - interval '1 hour')
    + (select count(*) from public.table_upload_intents
      where uploader_id = p_actor and created_at > checked_at - interval '1 hour')) >= 12 then
    raise exception 'Hourly photo limit reached. Try again later' using errcode = 'P0001'; end if;
  if ((select count(*) from public.media_upload_intents
      where uploader_id = p_actor and state in ('pending', 'processing')
        and created_at > checked_at - interval '1 hour')
    + (select count(*) from public.table_upload_intents
      where uploader_id = p_actor and state in ('pending', 'processing')
        and created_at > checked_at - interval '1 hour')) >= 6 then
    raise exception 'Wait for your current photos to finish processing' using errcode = 'P0001'; end if;
end $$;

create or replace function public.request_plate_upload()
returns table(intent_id uuid, staged_path text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fresh uuid := gen_random_uuid();
begin
  perform private.check_photo_upload_quota(actor);
  insert into public.media_upload_intents(id, uploader_id, staged_path)
    values (fresh, actor, actor::text || '/' || fresh::text)
    returning id, media_upload_intents.staged_path into intent_id, staged_path;
  return next;
end $$;
create function public.request_table_upload(p_group_id uuid)
returns table(intent_id uuid, staged_path text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fresh uuid := gen_random_uuid();
begin
  perform 1 from public.groups where id = p_group_id and availability = 'available' for share;
  if not found or not private.is_active_member(p_group_id) then
    raise exception 'Active Table membership required' using errcode = '42501'; end if;
  perform private.check_photo_upload_quota(actor);
  insert into public.table_upload_intents(id, uploader_id, group_id, staged_path)
    values (fresh, actor, p_group_id, actor::text || '/' || fresh::text)
    returning id, table_upload_intents.staged_path into intent_id, staged_path;
  return next;
end $$;
revoke all on function private.check_photo_upload_quota(uuid), public.request_table_upload(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.request_table_upload(uuid) to authenticated;

create function public.finish_table_upload(p_intent_id uuid, p_asset_id uuid,
  p_object_path text, p_width integer, p_height integer)
returns void language plpgsql security definer set search_path = '' as $$
declare intent public.table_upload_intents%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  select * into intent from public.table_upload_intents where id = p_intent_id for update;
  if not found or intent.state <> 'processing' then
    raise exception 'Upload intent unavailable' using errcode = '23514'; end if;
  if p_object_path is distinct from intent.group_id::text || '/' || p_asset_id::text || '.webp' then
    raise exception 'Invalid Table media path' using errcode = '23514'; end if;
  if not exists (select 1 from public.group_memberships m
      join public.groups g on g.id = m.group_id
      where m.group_id = intent.group_id and m.user_id = intent.uploader_id
        and m.state = 'active' and g.availability = 'available') then
    raise exception 'Table membership ended before processing' using errcode = '42501'; end if;
  insert into public.table_media_assets(id, uploader_id, group_id, source_intent_id,
    bucket_id, object_path, media_type, width, height)
    values (p_asset_id, intent.uploader_id, intent.group_id, intent.id,
      'table-media', p_object_path, 'image/webp', p_width, p_height);
  update public.table_upload_intents set state = 'ready', asset_id = p_asset_id,
    updated_at = clock_timestamp() where id = p_intent_id;
end $$;
create function public.fail_table_upload(p_intent_id uuid, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  update public.table_upload_intents set state = 'failed',
    error_message = left(coalesce(p_message, 'Image processing failed'), 200),
    updated_at = clock_timestamp() where id = p_intent_id and state = 'processing';
end $$;
revoke all on function public.finish_table_upload(uuid,uuid,text,integer,integer),
  public.fail_table_upload(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.finish_table_upload(uuid,uuid,text,integer,integer),
  public.fail_table_upload(uuid,text) to service_role;

create function private.validate_table_images(p_ids uuid[], p_actor uuid, p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare image_id uuid; image_count integer := 0;
begin
  if p_ids is null or cardinality(p_ids) > 4 then
    raise exception 'Choose at most four Table photos' using errcode = '23514'; end if;
  foreach image_id in array p_ids loop
    image_count := image_count + 1;
    if image_id is null or image_id = any(p_ids[1:image_count-1]) then
      raise exception 'Duplicate or missing Table photo' using errcode = '23514'; end if;
    perform 1 from public.table_media_assets where id = image_id
      and uploader_id = p_actor and group_id = p_group_id for update;
    if not found or exists (select 1 from public.entry_media where asset_id = image_id)
      or exists (select 1 from public.reply_media where asset_id = image_id) then
      raise exception 'Table photo unavailable or already attached' using errcode = '23514'; end if;
  end loop;
end $$;

create or replace function private.check_m2_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare valid boolean; entry_key uuid; reply_key uuid; plate_key uuid;
begin
  if tg_table_name = 'plate_media' then plate_key := new.plate_id;
  elsif tg_table_name = 'plates' then plate_key := new.id;
  elsif tg_table_name = 'entry_media' then entry_key := new.entry_id;
  elsif tg_table_name = 'timeline_entries' then entry_key := new.id;
  elsif tg_table_name = 'reply_media' then reply_key := new.reply_id;
  else reply_key := new.id;
  end if;
  if plate_key is not null then
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      or exists (select 1 from public.plate_media where plate_id = plate_key)
      into valid from public.plates where id = plate_key;
  elsif entry_key is not null then
    select availability <> 'available' or kind in ('plate_share', 'request')
      or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      or exists (select 1 from public.entry_media where entry_id = entry_key)
      into valid from public.timeline_entries where id = entry_key;
  else
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      or exists (select 1 from public.reply_media where reply_id = reply_key)
      into valid from public.thread_replies where id = reply_key;
  end if;
  if valid is distinct from true then
    raise exception 'Available content requires text, a link or an image' using errcode = '23514'; end if;
  return null;
end $$;
create constraint trigger entry_media_content after insert or update on public.entry_media
  deferrable initially deferred for each row execute function private.check_m2_content();
create constraint trigger reply_media_content after insert or update on public.reply_media
  deferrable initially deferred for each row execute function private.check_m2_content();

create or replace function private.append_m2_entry(p_group_id uuid, p_request_id uuid, p_kind text,
  p_plate_id uuid, p_body text, p_links jsonb, p_attachments uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fingerprint text; existing public.timeline_entries%rowtype;
  result uuid; allocated bigint; plate_revision bigint; image_id uuid; pos integer;
begin
  perform 1 from public.groups where id = p_group_id and availability = 'available' for update;
  if not found or not private.is_active_member(p_group_id) then
    raise exception 'Active Table membership required' using errcode = '42501'; end if;
  if p_request_id is null or p_kind is null or p_kind not in ('message', 'plate_share') then
    raise exception 'Request identity and valid kind required' using errcode = '23514'; end if;
  if p_kind = 'plate_share' then
    select revision into plate_revision from public.plates
      where id = p_plate_id and availability = 'available' for share;
    if not found then raise exception 'Plate unavailable' using errcode = '42501'; end if;
  elsif p_plate_id is not null then
    raise exception 'A message cannot identify a Plate' using errcode = '23514'; end if;
  perform private.validate_m2_input(p_body, p_links,
    case when p_kind = 'message' then '{}'::uuid[] else p_attachments end, true);
  if p_attachments is null or cardinality(p_attachments) > 4 then
    raise exception 'Choose at most four Table photos' using errcode = '23514'; end if;
  if p_kind = 'message' and p_body !~ '[^[:space:]]'
    and jsonb_array_length(p_links) = 0 and cardinality(p_attachments) = 0 then
    raise exception 'Message needs text, a link or a photo' using errcode = '23514'; end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_array('m2-v1', p_kind, p_group_id,
    p_plate_id, p_body, p_links, to_jsonb(p_attachments))::text, 'UTF8')), 'hex');
  select * into existing from public.timeline_entries
    where author_id = actor and group_id = p_group_id and client_request_id = p_request_id;
  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception 'Request ID already used with different content' using errcode = '23505'; end if;
    return existing.id;
  end if;
  if p_kind = 'message' then perform private.validate_table_images(p_attachments, actor, p_group_id); end if;
  update public.groups set next_entry_position = next_entry_position + 1 where id = p_group_id
    returning next_entry_position - 1 into allocated;
  insert into public.timeline_entries(group_id, author_id, kind, body, links, position, client_request_id, request_fingerprint)
    values (p_group_id, actor, p_kind, p_body, p_links, allocated, p_request_id, fingerprint) returning id into result;
  if p_kind = 'plate_share' then
    insert into public.plate_shares(entry_id, plate_id, plate_revision_at_share) values (result, p_plate_id, plate_revision);
    insert into public.threads(root_entry_id, group_id, root_kind) values (result, p_group_id, p_kind);
  else
    for image_id, pos in select id, ordinality::integer from unnest(p_attachments)
      with ordinality as t(id, ordinality) loop
      insert into public.entry_media(entry_id, group_id, asset_id, position)
        values (result, p_group_id, image_id, pos);
    end loop;
  end if;
  return result;
end $$;

create or replace function public.reply_to_thread(p_thread_id uuid, p_client_request_id uuid,
  p_body text default '', p_links jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); group_key uuid; root_key uuid; allocated bigint;
  fingerprint text; existing public.thread_replies%rowtype; result uuid; image_id uuid; pos integer;
begin
  select group_id into group_key from public.threads where id = p_thread_id;
  perform 1 from public.groups where id = group_key and availability = 'available' for share;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode = '42501'; end if;
  select root_entry_id into root_key from public.threads where id = p_thread_id and group_id = group_key for update;
  if not found then raise exception 'Thread unavailable' using errcode = '42501'; end if;
  perform 1 from public.timeline_entries where id = root_key and availability = 'available';
  if not found then raise exception 'Thread unavailable for new replies' using errcode = '42501'; end if;
  if p_client_request_id is null then raise exception 'Request ID required' using errcode = '23514'; end if;
  perform private.validate_m2_input(p_body, p_links, '{}'::uuid[], true);
  if p_attachment_ids is null or cardinality(p_attachment_ids) > 4 then
    raise exception 'Choose at most four Table photos' using errcode = '23514'; end if;
  if p_body !~ '[^[:space:]]' and jsonb_array_length(p_links) = 0
    and cardinality(p_attachment_ids) = 0 then
    raise exception 'Reply needs text, a link or a photo' using errcode = '23514'; end if;
  fingerprint := encode(sha256(convert_to(jsonb_build_array('m2-v1', p_thread_id, p_body,
    p_links, to_jsonb(p_attachment_ids))::text, 'UTF8')), 'hex');
  select * into existing from public.thread_replies
    where author_id = actor and thread_id = p_thread_id and client_request_id = p_client_request_id;
  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception 'Request ID already used with different content' using errcode = '23505'; end if;
    return existing.id;
  end if;
  perform private.validate_table_images(p_attachment_ids, actor, group_key);
  update public.threads set next_reply_position = next_reply_position + 1 where id = p_thread_id
    returning next_reply_position - 1 into allocated;
  insert into public.thread_replies(thread_id, group_id, author_id, body, links, position, client_request_id, request_fingerprint)
    values (p_thread_id, group_key, actor, p_body, p_links, allocated, p_client_request_id, fingerprint) returning id into result;
  for image_id, pos in select id, ordinality::integer from unnest(p_attachment_ids)
    with ordinality as t(id, ordinality) loop
    insert into public.reply_media(reply_id, asset_id, position) values (result, image_id, pos);
  end loop;
  return result;
end $$;

create function public.table_image_locations(p_group_id uuid)
returns table(asset_id uuid, object_path text, width integer, height integer,
  entry_id uuid, reply_id uuid, image_position integer, occurred_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.object_path, a.width, a.height, em.entry_id, null::uuid, em.position, e.created_at
    from public.entry_media em join public.timeline_entries e on e.id = em.entry_id
    join public.table_media_assets a on a.id = em.asset_id
    where e.group_id = p_group_id and e.availability = 'available'
      and private.is_active_member(p_group_id)
  union all
  select a.id, a.object_path, a.width, a.height, null::uuid, rm.reply_id, rm.position, r.created_at
    from public.reply_media rm join public.thread_replies r on r.id = rm.reply_id
    join public.table_media_assets a on a.id = rm.asset_id
    where r.group_id = p_group_id and r.availability = 'available'
      and private.is_active_member(p_group_id);
$$;
revoke all on function private.validate_table_images(uuid[],uuid,uuid),
  public.table_image_locations(uuid) from public, anon, authenticated, service_role;
grant execute on function public.table_image_locations(uuid) to authenticated;

commit;
