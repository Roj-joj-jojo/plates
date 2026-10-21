-- M4b: private, saver-owned first-photo previews for frozen Menu reminders.
-- Additive. No object cleanup, unsave or erasure operation is enabled.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run M4b with the local migration role postgres';
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit)
  values ('menu-previews', 'menu-previews', false, 3000000);

create table public.menu_preview_jobs (
  id uuid primary key default gen_random_uuid(),
  saver_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  plate_id uuid not null references public.plates(id) on update restrict on delete restrict,
  source_asset_id uuid not null references public.media_assets(id) on update restrict on delete restrict,
  source_revision bigint not null check (source_revision > 0),
  state text not null default 'pending' check (state in ('pending', 'processing', 'ready', 'failed')),
  preview_asset_id uuid unique,
  error_message text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((state = 'ready') = (preview_asset_id is not null)),
  check (state <> 'failed' or error_message is not null)
);
create index menu_preview_jobs_saver_time on public.menu_preview_jobs(saver_id, created_at desc);
create index menu_preview_jobs_pending on public.menu_preview_jobs(created_at) where state = 'pending';

create table public.menu_preview_assets (
  id uuid primary key,
  job_id uuid not null unique references public.menu_preview_jobs(id) on update restrict on delete restrict,
  saver_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  plate_id uuid not null references public.plates(id) on update restrict on delete restrict,
  source_asset_id uuid not null references public.media_assets(id) on update restrict on delete restrict,
  source_revision bigint not null check (source_revision > 0),
  bucket_id text not null check (bucket_id = 'menu-previews'),
  object_path text not null unique,
  width integer not null check (width between 1 and 640),
  height integer not null check (height between 1 and 640),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.menu_preview_jobs add constraint menu_preview_job_asset_fk
  foreign key (preview_asset_id) references public.menu_preview_assets(id)
  on update restrict on delete restrict;
alter table public.menu_plate_saves add column preview_asset_id uuid unique
  references public.menu_preview_assets(id) on update restrict on delete restrict;

alter table public.menu_preview_jobs enable row level security;
alter table public.menu_preview_assets enable row level security;
create policy menu_preview_jobs_owner_read on public.menu_preview_jobs for select to authenticated
  using (saver_id = (select private.current_profile_id()));
create policy menu_preview_assets_owner_read on public.menu_preview_assets for select to authenticated
  using (saver_id = (select private.current_profile_id()));
grant select (id, state, preview_asset_id, error_message, created_at)
  on public.menu_preview_jobs to authenticated;
grant select (id, width, height) on public.menu_preview_assets to authenticated;
grant select (preview_asset_id) on public.menu_plate_saves to authenticated;
grant select, insert, update on public.menu_preview_jobs, public.menu_preview_assets to service_role;

create trigger menu_preview_jobs_no_delete before delete on public.menu_preview_jobs for each row
  execute function private.reject_m2_delete();
create trigger menu_preview_assets_no_delete before delete on public.menu_preview_assets for each row
  execute function private.reject_m2_delete();
create trigger menu_preview_jobs_immutable before update on public.menu_preview_jobs for each row
  execute function private.guard_record_update('id', 'saver_id', 'plate_id', 'source_asset_id',
    'source_revision', 'created_at');
create trigger menu_preview_assets_immutable before update on public.menu_preview_assets for each row
  execute function private.guard_record_update('id', 'job_id', 'saver_id', 'plate_id',
    'source_asset_id', 'source_revision', 'bucket_id', 'object_path', 'width', 'height', 'created_at');
create trigger menu_saves_preview_immutable before update on public.menu_plate_saves for each row
  execute function private.guard_record_update('preview_asset_id');

create function private.can_read_menu_preview_object(p_bucket text, p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket = 'menu-previews' and exists (
    select 1 from public.menu_preview_assets a
      join public.menu_plate_saves s on s.preview_asset_id = a.id
      where a.bucket_id = p_bucket and a.object_path = p_path
        and s.saver_id = private.current_profile_id() and s.availability = 'available'
  );
$$;
revoke all on function private.can_read_menu_preview_object(text,text)
  from public, anon, authenticated, service_role;
grant execute on function private.can_read_menu_preview_object(text,text) to authenticated;
create policy menu_preview_object_read on storage.objects for select to authenticated
  using (bucket_id = 'menu-previews'
    and storage.allow_any_operation(array['object.get_authenticated', 'object.sign'])
    and private.can_read_menu_preview_object(bucket_id, name));

create function public.request_menu_preview(p_plate_id uuid, p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); current_plate public.plates%rowtype;
  first_asset uuid; existing_job uuid; fresh uuid;
begin
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

create function public.finish_menu_preview(p_job_id uuid, p_asset_id uuid,
  p_object_path text, p_width integer, p_height integer)
returns void language plpgsql security definer set search_path = '' as $$
declare job public.menu_preview_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  select * into job from public.menu_preview_jobs where id = p_job_id for update;
  if not found or job.state <> 'processing' then
    raise exception 'Menu preview job unavailable' using errcode = '23514'; end if;
  if p_object_path is distinct from job.saver_id::text || '/' || p_asset_id::text || '.webp' then
    raise exception 'Invalid Menu preview path' using errcode = '23514'; end if;
  insert into public.menu_preview_assets(id, job_id, saver_id, plate_id, source_asset_id,
    source_revision, bucket_id, object_path, width, height)
    values (p_asset_id, job.id, job.saver_id, job.plate_id, job.source_asset_id,
      job.source_revision, 'menu-previews', p_object_path, p_width, p_height);
  update public.menu_preview_jobs set state = 'ready', preview_asset_id = p_asset_id,
    updated_at = clock_timestamp() where id = job.id;
end $$;
create function public.fail_menu_preview(p_job_id uuid, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  update public.menu_preview_jobs set state = 'failed',
    error_message = left(coalesce(p_message, 'Menu preview processing failed'), 200),
    updated_at = clock_timestamp() where id = p_job_id and state = 'processing';
end $$;
revoke all on function public.request_menu_preview(uuid,bigint),
  public.finish_menu_preview(uuid,uuid,text,integer,integer), public.fail_menu_preview(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_menu_preview(uuid,bigint) to authenticated;
grant execute on function public.finish_menu_preview(uuid,uuid,text,integer,integer),
  public.fail_menu_preview(uuid,text) to service_role;

create function public.menu_preview_location(p_save_id uuid)
returns table(object_path text, width integer, height integer)
language sql stable security definer set search_path = '' as $$
  select a.object_path, a.width, a.height from public.menu_plate_saves s
    join public.menu_preview_assets a on a.id = s.preview_asset_id
    where s.id = p_save_id and s.saver_id = private.current_profile_id()
      and s.availability = 'available';
$$;
revoke all on function public.menu_preview_location(uuid) from public, anon, authenticated, service_role;
grant execute on function public.menu_preview_location(uuid) to authenticated;

create or replace function private.require_photo_preview_before_menu_save()
returns trigger language plpgsql security definer set search_path = '' as $$
declare first_asset uuid;
begin
  select asset_id into first_asset from public.plate_media
    where plate_id = new.plate_id order by position limit 1;
  if first_asset is null then
    if new.preview_asset_id is not null then
      raise exception 'A text-only Plate cannot have a Menu photo preview' using errcode = '23514'; end if;
  elsif new.preview_asset_id is null or not exists (
      select 1 from public.menu_preview_assets a
        join public.menu_preview_jobs j on j.id = a.job_id
        where a.id = new.preview_asset_id and a.saver_id = new.saver_id
          and a.plate_id = new.plate_id and a.source_asset_id = first_asset
          and a.source_revision = new.snapshot_revision and j.state = 'ready'
    ) then
    raise exception 'Saving photo Plates needs a private Menu preview first' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function private.check_menu_snapshot_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare valid boolean;
begin
  select availability <> 'available' or snapshot_body ~ '[^[:space:]]'
    or jsonb_array_length(snapshot_links) > 0 or preview_asset_id is not null
    into valid from public.menu_plate_saves where id = new.id;
  if valid is distinct from true then
    raise exception 'Saved reminder requires text, a link or a photo preview' using errcode = '23514'; end if;
  return null;
end $$;

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
commit;
