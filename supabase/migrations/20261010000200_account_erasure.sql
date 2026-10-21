-- Candidate only: account access cutoff, content blanking and durable cleanup work.
-- Do not apply until the owner has reviewed the guard/constraint replacements and deletion scope.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run account erasure migration with the local migration role postgres';
  end if;
end $$;

-- A disabled profile must be nameless while Storage/Auth cleanup is pending.
alter table public.profiles drop constraint profiles_name_valid;
alter table public.profiles add constraint profiles_name_valid check (
  (state = 'erased' and display_name is null)
  or (state = 'disabled' and display_name is null)
  or (state in ('active', 'disabled') and display_name is not null
    and char_length(display_name) between 1 and 80
    and display_name !~ '^[[:space:]]|[[:space:]]$'
    and display_name !~ '[[:cntrl:]]')
);
-- Request details have no availability column; the parent entry owns the erased state.
alter table public.requests drop constraint requests_question_check;
alter table public.requests add constraint requests_question_check check (
  question = '' or (char_length(question) between 1 and 500
    and question ~ '[^[:space:]]' and question !~ '[[:cntrl:]]')
);

create table private.account_erasure_jobs (
  profile_id uuid primary key references public.profiles(id) on update restrict on delete restrict,
  auth_user_id uuid unique,
  state text not null default 'cleaning' check (state in ('cleaning', 'auth_pending', 'complete')),
  started_at timestamptz not null default clock_timestamp(),
  reconciled_at timestamptz,
  completed_at timestamptz,
  check ((state = 'complete') = (completed_at is not null)),
  check ((state = 'complete') = (auth_user_id is null))
);
create table private.account_erasure_objects (
  profile_id uuid not null references private.account_erasure_jobs(profile_id) on update restrict on delete restrict,
  bucket_id text not null check (bucket_id in
    ('staged-assets', 'plate-media', 'table-staged-assets', 'table-media', 'menu-previews')),
  object_path text not null,
  state text not null default 'pending' check (state in ('pending', 'processing', 'removed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (profile_id, bucket_id, object_path)
);
create index account_erasure_objects_work on private.account_erasure_objects(state, updated_at);
create table private.media_object_attempts (
  bucket_id text not null check (bucket_id in ('plate-media', 'table-media', 'menu-previews')),
  object_path text not null,
  owner_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  source_plate_id uuid references public.plates(id) on update restrict on delete restrict,
  state text not null default 'processing' check (state in ('processing', 'finished')),
  created_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  check ((state = 'finished') = (finished_at is not null)),
  primary key (bucket_id, object_path)
);
create index media_object_attempts_owner on private.media_object_attempts(owner_id);
create index media_object_attempts_plate on private.media_object_attempts(source_plate_id);
revoke all on private.account_erasure_jobs, private.account_erasure_objects
  from public, anon, authenticated, service_role;
revoke all on private.media_object_attempts from public, anon, authenticated, service_role;
alter table private.account_erasure_jobs enable row level security;
alter table private.account_erasure_objects enable row level security;
alter table private.media_object_attempts enable row level security;

-- Only the erasure function sets this transaction-local marker. Client roles have no
-- direct UPDATE on these content tables. The trigger still checks each allowed field.
create function private.guard_erasure_update()
returns trigger language plpgsql set search_path = '' as $$
declare field_name text; erasing boolean; permitted text[] := '{}'; actor text;
begin
  actor := current_setting('plates.erasure_profile', true);
  erasing := actor is not null and actor <> '';
  if erasing then
    if tg_table_name = 'plates' then
      if new.availability = 'erased' and old.author_id::text = actor then
        permitted := array['author_id'];
      end if;
    elsif tg_table_name in ('timeline_entries', 'thread_replies') then
      if new.availability = 'erased' and old.author_id::text = actor then
        permitted := array['author_id', 'request_fingerprint'];
      end if;
    elsif tg_table_name = 'menu_plate_saves' then
      if new.availability = 'erased'
          and (old.saver_id::text = actor or old.original_author_id::text = actor) then
        permitted := array['availability', 'snapshot_body', 'snapshot_links', 'snapshot_tags',
          'snapshot_category_id', 'snapshot_category_label', 'original_author_id',
          'snapshot_author_name', 'preview_asset_id'];
      end if;
    end if;
  end if;
  foreach field_name in array tg_argv loop
    if not field_name = any(permitted)
      and (to_jsonb(new) -> field_name) is distinct from (to_jsonb(old) -> field_name) then
      raise exception 'Immutable field: %', field_name using errcode = '23514';
    end if;
  end loop;
  if erasing and tg_table_name = 'menu_plate_saves' then
    if new.availability = 'erased' and new.preview_asset_id is not null then
      raise exception 'Erased Menu preview must be removed' using errcode = '23514';
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger plates_immutable on public.plates;
create trigger plates_immutable before update on public.plates for each row
  execute function private.guard_erasure_update('id', 'author_id', 'created_at');
drop trigger entries_immutable on public.timeline_entries;
create trigger entries_immutable before update on public.timeline_entries for each row
  execute function private.guard_erasure_update('id', 'group_id', 'author_id', 'kind',
    'position', 'client_request_id', 'request_fingerprint', 'created_at');
drop trigger replies_immutable on public.thread_replies;
create trigger replies_immutable before update on public.thread_replies for each row
  execute function private.guard_erasure_update('id', 'thread_id', 'group_id', 'author_id',
    'position', 'client_request_id', 'request_fingerprint', 'created_at');
drop trigger menu_saves_immutable on public.menu_plate_saves;
drop trigger menu_saves_preview_immutable on public.menu_plate_saves;
create trigger menu_saves_immutable before update on public.menu_plate_saves for each row
  execute function private.guard_erasure_update('id', 'saver_id', 'plate_id', 'saved_at',
    'snapshot_revision', 'availability', 'snapshot_body', 'snapshot_links', 'snapshot_tags',
    'snapshot_category_id', 'snapshot_category_label', 'original_author_id',
    'snapshot_author_name', 'preview_asset_id', 'created_at');

create function private.guard_request_erasure()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.entry_id is distinct from old.entry_id or new.kind is distinct from old.kind
    or new.created_at is distinct from old.created_at then
    raise exception 'Request identity is immutable' using errcode = '23514';
  end if;
  if new.question is distinct from old.question and not (
    new.question = '' and current_setting('plates.erasure_profile', true) is not null
    and exists (select 1 from public.timeline_entries e
      where e.id = new.entry_id and e.availability = 'erased')) then
    raise exception 'Request question is immutable' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger requests_immutable on public.requests;
create trigger requests_immutable before update on public.requests for each row
  execute function private.guard_request_erasure();
create function private.check_erased_request_question()
returns trigger language plpgsql security definer set search_path = '' as $$
declare request_key uuid; erased boolean; blank boolean;
begin
  if tg_table_name = 'requests' then request_key := new.entry_id;
  elsif new.kind = 'request' then request_key := new.id;
  else return null;
  end if;
  select e.availability = 'erased', r.question = '' into erased, blank
    from public.timeline_entries e join public.requests r on r.entry_id = e.id
    where e.id = request_key;
  if erased is distinct from blank then
    raise exception 'Erased Request must have a blank question' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger requests_erasure_consistent after insert or update on public.requests
  deferrable initially deferred for each row execute function private.check_erased_request_question();
create constraint trigger request_entries_erasure_consistent after insert or update on public.timeline_entries
  deferrable initially deferred for each row execute function private.check_erased_request_question();

create function private.guard_erasure_auth_link_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role'
    or current_setting('plates.erasure_unlink', true) is distinct from old.profile_id::text
    or not exists (select 1 from private.account_erasure_jobs j
      where j.profile_id = old.profile_id and j.state = 'cleaning') then
    raise exception 'Auth link removal requires completed erasure cleanup' using errcode = '23514';
  end if;
  return old;
end $$;
drop trigger auth_links_no_delete on private.profile_auth_links;
create trigger auth_links_no_delete before delete on private.profile_auth_links for each row
  execute function private.guard_erasure_auth_link_delete();

-- A worker cannot publish a new asset once either its owner or source was erased.
-- The profile locks serialize this check with the account cutoff transaction.
create function private.guard_erasure_media_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_key uuid; source_author uuid;
begin
  if tg_table_name = 'menu_preview_assets' then
    owner_key := new.saver_id;
    select author_id into source_author from public.plates where id = new.plate_id;
    perform 1 from public.profiles where id in (owner_key, source_author) order by id for share;
    if not exists (select 1 from public.profiles where id = owner_key and state = 'active')
      or not exists (select 1 from public.plates
        where id = new.plate_id and availability = 'available' and author_id = source_author) then
      raise exception 'Menu preview source or saver unavailable' using errcode = '42501';
    end if;
  else
    owner_key := new.uploader_id;
    perform 1 from public.profiles where id = owner_key and state = 'active' for share;
    if not found then raise exception 'Uploader unavailable' using errcode = '42501'; end if;
    if tg_table_name = 'table_media_assets' and not exists (
      select 1 from public.group_memberships m join public.groups g on g.id = m.group_id
      where m.group_id = new.group_id and m.user_id = owner_key
        and m.state = 'active' and g.availability = 'available') then
      raise exception 'Table membership unavailable' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger media_assets_erasure_guard before insert on public.media_assets for each row
  execute function private.guard_erasure_media_insert();
create trigger table_media_assets_erasure_guard before insert on public.table_media_assets for each row
  execute function private.guard_erasure_media_insert();
create trigger menu_preview_assets_erasure_guard before insert on public.menu_preview_assets for each row
  execute function private.guard_erasure_media_insert();

create function public.begin_account_erasure()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id(); auth_key uuid; group_key uuid;
  successor uuid; affected_plate_ids uuid[]; affected_request_ids uuid[];
begin
  if actor is null then raise exception 'Active sign-in required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = actor and state = 'active' for update;
  if not found then raise exception 'Active profile required' using errcode = '42501'; end if;
  select auth_user_id into auth_key from private.profile_auth_links where profile_id = actor;
  if auth_key is distinct from auth.uid() then
    raise exception 'Auth link mismatch' using errcode = '42501'; end if;
  perform set_config('plates.erasure_profile', actor::text, true);
  insert into private.account_erasure_jobs(profile_id, auth_user_id) values (actor, auth_key);
  update public.profiles set state = 'disabled', display_name = null where id = actor;

  select coalesce(array_agg(id), '{}') into affected_plate_ids
    from public.plates where author_id = actor;
  select coalesce(array_agg(id), '{}') into affected_request_ids
    from public.timeline_entries where author_id = actor and kind = 'request';
  for group_key in select g.id from public.groups g
    where g.created_by = actor or exists (select 1 from public.group_memberships m
      where m.group_id = g.id and m.user_id = actor and m.state = 'active')
    order by g.id loop
    perform 1 from public.groups where id = group_key for update;
    select m.user_id into successor from public.group_memberships m
      where m.group_id = group_key and m.user_id <> actor and m.role = 'owner' and m.state = 'active'
      order by m.user_id limit 1;
    if successor is null and ((select created_by from public.groups where id = group_key) = actor
      or exists (select 1 from public.group_memberships
        where group_id = group_key and user_id = actor and state = 'active' and role = 'owner')) then
      update public.groups set availability = 'erased', name = null, created_by = null
        where id = group_key;
    elsif (select created_by from public.groups where id = group_key) = actor then
      update public.groups set created_by = successor, name = 'Table' where id = group_key;
    end if;
    update public.membership_periods set ended_at = greatest(clock_timestamp(), joined_at + interval '1 microsecond'),
      end_reason = 'erased' where group_id = group_key and user_id = actor and ended_at is null;
    update public.group_memberships set state = 'removed'
      where group_id = group_key and user_id = actor and state = 'active';
  end loop;

  update public.plates set availability = 'erased', author_id = null, category_id = null,
    body = '', links = '[]', tags = '[]' where author_id = actor;
  update public.timeline_entries set availability = 'erased', author_id = null,
    body = '', links = '[]', request_fingerprint = null where author_id = actor;
  update public.thread_replies set availability = 'erased', author_id = null,
    body = '', links = '[]', request_fingerprint = null where author_id = actor;
  update public.requests set question = '' where entry_id = any(affected_request_ids);
  update public.menu_plate_saves set availability = 'erased', snapshot_body = '',
    snapshot_links = '[]', snapshot_tags = '[]', snapshot_category_id = null,
    snapshot_category_label = '', original_author_id = null, snapshot_author_name = '',
    preview_asset_id = null
    where saver_id = actor or plate_id = any(affected_plate_ids);

  insert into private.account_erasure_objects(profile_id, bucket_id, object_path)
    select actor, 'staged-assets', staged_path from public.media_upload_intents where uploader_id = actor
    union select actor, 'plate-media', object_path from public.media_assets where uploader_id = actor
    union select actor, 'table-staged-assets', staged_path from public.table_upload_intents where uploader_id = actor
    union select actor, 'table-media', object_path from public.table_media_assets where uploader_id = actor
    union select actor, 'menu-previews', object_path from public.menu_preview_assets
      where saver_id = actor or plate_id = any(affected_plate_ids)
    union select actor, bucket_id, object_path from private.media_object_attempts
      where owner_id = actor or source_plate_id = any(affected_plate_ids)
    on conflict do nothing;
  return actor;
end $$;
revoke all on function public.begin_account_erasure() from public, anon, authenticated, service_role;
grant execute on function public.begin_account_erasure() to authenticated;

create function public.register_media_object_attempt(p_bucket_id text, p_object_path text,
  p_owner_id uuid, p_source_plate_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare source_author uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  if p_bucket_id not in ('plate-media', 'table-media', 'menu-previews')
    or p_object_path is null or p_object_path = '' then
    raise exception 'Invalid media object attempt' using errcode = '23514'; end if;
  if p_source_plate_id is not null then
    select author_id into source_author from public.plates where id = p_source_plate_id;
  end if;
  perform 1 from public.profiles where id in (p_owner_id, source_author) order by id for share;
  if not exists (select 1 from public.profiles where id = p_owner_id and state = 'active')
    or (p_source_plate_id is not null and not exists (
      select 1 from public.plates where id = p_source_plate_id
        and availability = 'available' and author_id = source_author)) then
    raise exception 'Media owner or source unavailable' using errcode = '42501'; end if;
  insert into private.media_object_attempts(bucket_id, object_path, owner_id, source_plate_id)
    values (p_bucket_id, p_object_path, p_owner_id, p_source_plate_id)
    on conflict (bucket_id, object_path) do nothing;
end $$;
revoke all on function public.register_media_object_attempt(text,text,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.register_media_object_attempt(text,text,uuid,uuid) to service_role;

create function public.finish_media_object_attempt(p_bucket_id text, p_object_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  update private.media_object_attempts set state = 'finished', finished_at = clock_timestamp()
    where bucket_id = p_bucket_id and object_path = p_object_path and state = 'processing';
end $$;
revoke all on function public.finish_media_object_attempt(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.finish_media_object_attempt(text,text) to service_role;

create function public.erasure_worker_jobs()
returns table(profile_id uuid, auth_user_id uuid, state text, started_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  return query select j.profile_id, j.auth_user_id, j.state, j.started_at
    from private.account_erasure_jobs j where j.state <> 'complete' order by j.started_at;
end $$;
create function public.erasure_claim_objects()
returns table(profile_id uuid, bucket_id text, object_path text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  return query with chosen as (
    select o.profile_id, o.bucket_id, o.object_path
      from private.account_erasure_objects o
      where o.state = 'pending' or (o.state = 'processing'
        and o.updated_at < clock_timestamp() - interval '2 minutes')
      order by o.updated_at limit 20 for update skip locked
  ) update private.account_erasure_objects o
    set state = 'processing', attempts = attempts + 1, updated_at = clock_timestamp()
    from chosen c where o.profile_id = c.profile_id and o.bucket_id = c.bucket_id
      and o.object_path = c.object_path
    returning o.profile_id, o.bucket_id, o.object_path;
end $$;
create function public.erasure_record_object(p_profile_id uuid, p_bucket_id text, p_object_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  if not exists (select 1 from private.account_erasure_jobs
      where profile_id = p_profile_id and state = 'cleaning') then
    raise exception 'Erasure job unavailable' using errcode = '23514'; end if;
  insert into private.account_erasure_objects(profile_id, bucket_id, object_path)
    values (p_profile_id, p_bucket_id, p_object_path)
    on conflict (profile_id, bucket_id, object_path) do update
      set state = 'pending', updated_at = clock_timestamp();
  update private.account_erasure_jobs set reconciled_at = null where profile_id = p_profile_id;
end $$;
create function public.erasure_object_result(p_profile_id uuid, p_bucket_id text,
  p_object_path text, p_removed boolean, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  update private.account_erasure_objects
    set state = case when p_removed then 'removed' else 'pending' end,
      last_error = case when p_removed then null else left(coalesce(p_error, 'Removal failed'), 200) end,
      updated_at = clock_timestamp()
    where profile_id = p_profile_id and bucket_id = p_bucket_id
      and object_path = p_object_path and state = 'processing';
  if not found then raise exception 'Erasure object not claimed' using errcode = '23514'; end if;
end $$;
create function public.erasure_mark_reconciled(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  update private.account_erasure_jobs set reconciled_at = clock_timestamp()
    where profile_id = p_profile_id and state = 'cleaning';
end $$;
create function public.erasure_advance_identity(p_profile_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare job private.account_erasure_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  select * into job from private.account_erasure_jobs
    where profile_id = p_profile_id for update;
  if not found then raise exception 'Erasure job unavailable' using errcode = '23514'; end if;
  if job.state = 'auth_pending' then return job.auth_user_id; end if;
  if job.state <> 'cleaning' or job.reconciled_at is null
    or exists (select 1 from private.account_erasure_objects
      where profile_id = p_profile_id and state <> 'removed')
    or exists (select 1 from private.media_object_attempts a
      join private.account_erasure_objects o on o.bucket_id = a.bucket_id
        and o.object_path = a.object_path and o.profile_id = p_profile_id
      where a.state = 'processing') then
    raise exception 'Storage cleanup is incomplete' using errcode = '23514'; end if;
  perform set_config('plates.erasure_unlink', p_profile_id::text, true);
  delete from private.profile_auth_links where profile_id = p_profile_id;
  update public.profiles set state = 'erased' where id = p_profile_id;
  update private.account_erasure_jobs set state = 'auth_pending' where profile_id = p_profile_id;
  return job.auth_user_id;
end $$;
create function public.erasure_auth_removed(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare job private.account_erasure_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Erasure worker required' using errcode = '42501'; end if;
  select * into job from private.account_erasure_jobs where profile_id = p_profile_id for update;
  if not found or job.state <> 'auth_pending' then
    raise exception 'Auth removal was not pending' using errcode = '23514'; end if;
  if exists (select 1 from auth.users where id = job.auth_user_id) then
    raise exception 'Auth identity still exists' using errcode = '23514'; end if;
  update private.account_erasure_jobs set state = 'complete', auth_user_id = null,
    completed_at = clock_timestamp()
    where profile_id = p_profile_id and state = 'auth_pending';
end $$;
revoke all on function public.erasure_worker_jobs(), public.erasure_claim_objects(),
  public.erasure_record_object(uuid,text,text), public.erasure_object_result(uuid,text,text,boolean,text),
  public.erasure_mark_reconciled(uuid), public.erasure_advance_identity(uuid),
  public.erasure_auth_removed(uuid) from public, anon, authenticated, service_role;
grant execute on function public.erasure_worker_jobs(), public.erasure_claim_objects(),
  public.erasure_record_object(uuid,text,text), public.erasure_object_result(uuid,text,text,boolean,text),
  public.erasure_mark_reconciled(uuid), public.erasure_advance_identity(uuid),
  public.erasure_auth_removed(uuid) to service_role;

revoke all on function private.guard_erasure_update(), private.guard_request_erasure(),
  private.check_erased_request_question(), private.guard_erasure_auth_link_delete(),
  private.guard_erasure_media_insert()
  from public, anon, authenticated, service_role;
commit;
