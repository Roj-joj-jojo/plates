-- M2: text/link Plates, Table messages, independent share threads and replies.
-- Additive local migration. Media/erasure operations remain deferred to M4/M6.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run M2 with the local migration role postgres';
  end if;
end $$;

-- Parse the URL authority without network requests or an added extension.
-- ASCII DNS/punycode, IPv4 and bracketed IPv6 hosts are accepted. Unicode host
-- names must be supplied in their ASCII/punycode form; Unicode paths are valid.
create function private.valid_content_links(p_links jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; url text; parts text[]; authority text; host text; port text; label text;
begin
  if p_links is null or jsonb_typeof(p_links) <> 'array' then return false; end if;
  if jsonb_array_length(p_links) > 10 then return false; end if;
  for item in select value from jsonb_array_elements(p_links) loop
    if jsonb_typeof(item) <> 'string' then return false; end if;
    url := item #>> '{}';
    if char_length(url) > 2048 or url ~ '[[:space:][:cntrl:]]'
      or strpos(url, chr(92)) > 0 then return false; end if;
    parts := regexp_match(url, '^https?://([^/?#]+)([/?#].*)?$', 'i');
    if parts is null then return false; end if;
    authority := parts[1];
    if authority ~ '[@%]' then return false; end if;
    port := null;
    if left(authority, 1) = '[' then
      parts := regexp_match(authority, '^\[([0-9a-fA-F:.]+)\](:([0-9]+))?$');
      if parts is null then return false; end if;
      host := parts[1]; port := parts[3];
      begin
        if family(host::inet) <> 6 then return false; end if;
      exception when invalid_text_representation then return false;
      end;
    else
      parts := regexp_match(authority, '^([^:]+)(:([0-9]+))?$');
      if parts is null then return false; end if;
      host := parts[1]; port := parts[3];
      if char_length(host) > 254 then return false; end if;
      host := regexp_replace(host, '\.$', '');
      foreach label in array string_to_array(host, '.') loop
        if char_length(label) not between 1 and 63
          or label !~ '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$' then return false; end if;
      end loop;
      if host = '' then return false; end if;
      if host ~ '^[0-9.]+$' then
        begin
          if family(host::inet) <> 4 or host !~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
            then return false; end if;
        exception when invalid_text_representation then return false;
        end;
      end if;
    end if;
    if port is not null then
      if char_length(port) > 5 then return false; end if;
      if port::integer > 65535 then return false; end if;
    end if;
    -- Every percent escape must encode a byte; encoded ASCII controls are denied.
    if strpos(regexp_replace(url, '%[0-9a-fA-F]{2}', '', 'g'), '%') > 0
      or url ~* '%(0[0-9a-f]|1[0-9a-f]|7f)' then return false; end if;
  end loop;
  return true;
end $$;

create function private.canonical_tags(p_tags jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare item jsonb; tag text; result jsonb := '[]';
begin
  if p_tags is null or jsonb_typeof(p_tags) <> 'array' then
    raise exception 'Tags must be an array' using errcode = '23514';
  end if;
  for item in select value from jsonb_array_elements(p_tags) loop
    if jsonb_typeof(item) <> 'string' then
      raise exception 'Tags must contain strings' using errcode = '23514';
    end if;
    tag := pg_catalog.normalize(lower(pg_catalog.normalize(
      btrim(regexp_replace(item #>> '{}', '[[:space:]]+', ' ', 'g')), 'NFC')), 'NFC');
    if char_length(tag) not between 1 and 40 or tag ~ '[[:cntrl:]]' then
      raise exception 'Tags must contain 1–40 characters' using errcode = '23514';
    end if;
    if not result @> jsonb_build_array(tag) then result := result || jsonb_build_array(tag); end if;
    if jsonb_array_length(result) > 10 then
      raise exception 'At most 10 distinct tags' using errcode = '23514';
    end if;
  end loop;
  return result;
end $$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('meal', 'recipe', 'place')),
  label text not null check (label ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
insert into public.categories(slug, label) values
  ('meal', 'Meal'), ('recipe', 'Recipe'), ('place', 'Place');

create table public.plates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on update restrict on delete restrict,
  category_id uuid references public.categories(id) on update restrict on delete restrict,
  body text not null default '' check (char_length(body) <= 20000),
  links jsonb not null default '[]' check (private.valid_content_links(links)),
  tags jsonb not null default '[]' check (tags = private.canonical_tags(tags)),
  revision bigint not null default 1 check (revision > 0),
  availability text not null default 'available' check (availability in ('available', 'removed', 'erased')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (availability <> 'available' or (author_id is not null and category_id is not null)),
  check (availability <> 'erased' or
    (author_id is null and category_id is null and body = '' and links = '[]' and tags = '[]'))
);
create index plates_author on public.plates(author_id);
create index plates_category on public.plates(category_id);

create table public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on update restrict on delete restrict,
  author_id uuid references public.profiles(id) on update restrict on delete restrict,
  kind text not null check (kind in ('message', 'plate_share')),
  body text not null default '' check (char_length(body) <= 20000),
  links jsonb not null default '[]' check (private.valid_content_links(links)),
  position bigint not null check (position > 0),
  availability text not null default 'available' check (availability in ('available', 'removed', 'erased')),
  client_request_id uuid not null,
  request_fingerprint text check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (group_id, position), unique (author_id, group_id, client_request_id),
  unique (id, kind), unique (id, group_id, kind),
  check (availability <> 'available' or (author_id is not null and request_fingerprint is not null)),
  check (availability = 'available' or (body = '' and links = '[]')),
  check (availability <> 'erased' or (author_id is null and request_fingerprint is null))
);
create table public.plate_shares (
  entry_id uuid primary key,
  kind text not null default 'plate_share' check (kind = 'plate_share'),
  plate_id uuid not null references public.plates(id) on update restrict on delete restrict,
  plate_revision_at_share bigint not null check (plate_revision_at_share > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (entry_id, kind) references public.timeline_entries(id, kind) on update restrict on delete restrict,
  unique (entry_id, plate_id)
);
create index plate_shares_plate on public.plate_shares(plate_id);
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  root_entry_id uuid not null unique,
  group_id uuid not null,
  root_kind text not null check (root_kind = 'plate_share'),
  next_reply_position bigint not null default 1 check (next_reply_position > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, group_id),
  foreign key (root_entry_id, group_id, root_kind)
    references public.timeline_entries(id, group_id, kind) on update restrict on delete restrict
);
create index threads_group on public.threads(group_id);
create table public.thread_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  group_id uuid not null,
  author_id uuid references public.profiles(id) on update restrict on delete restrict,
  body text not null default '' check (char_length(body) <= 20000),
  links jsonb not null default '[]' check (private.valid_content_links(links)),
  position bigint not null check (position > 0),
  availability text not null default 'available' check (availability in ('available', 'removed', 'erased')),
  client_request_id uuid not null,
  request_fingerprint text check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (thread_id, group_id) references public.threads(id, group_id) on update restrict on delete restrict,
  unique (thread_id, position), unique (author_id, thread_id, client_request_id),
  check (availability <> 'available' or (author_id is not null and request_fingerprint is not null)),
  check (availability = 'available' or (body = '' and links = '[]')),
  check (availability <> 'erased' or (author_id is null and request_fingerprint is null))
);
create index replies_group on public.thread_replies(group_id);
create index replies_author on public.thread_replies(author_id);

revoke all on public.categories, public.plates, public.timeline_entries,
  public.plate_shares, public.threads, public.thread_replies
  from public, anon, authenticated, service_role;
alter table public.categories enable row level security;
alter table public.plates enable row level security;
alter table public.timeline_entries enable row level security;
alter table public.plate_shares enable row level security;
alter table public.threads enable row level security;
alter table public.thread_replies enable row level security;
create policy categories_read on public.categories for select to authenticated
  using ((select private.current_profile_id()) is not null);
create policy plates_read on public.plates for select to authenticated
  using (availability = 'available' and (select private.current_profile_id()) is not null);
create policy entries_read on public.timeline_entries for select to authenticated
  using (private.is_active_member(group_id));
create policy shares_read on public.plate_shares for select to authenticated
  using (exists (select 1 from public.timeline_entries e where e.id = entry_id));
create policy threads_read on public.threads for select to authenticated
  using (private.is_active_member(group_id));
create policy replies_read on public.thread_replies for select to authenticated
  using (private.is_active_member(group_id));
grant select (id, slug, label, created_at, updated_at) on public.categories to authenticated;
grant select (id, author_id, category_id, body, links, tags, revision, availability, created_at, updated_at)
  on public.plates to authenticated;
grant select (id, group_id, author_id, kind, body, links, position, availability, created_at, updated_at)
  on public.timeline_entries to authenticated;
grant select (entry_id, kind, plate_id, plate_revision_at_share, created_at, updated_at)
  on public.plate_shares to authenticated;
grant select (id, root_entry_id, group_id, root_kind, created_at, updated_at)
  on public.threads to authenticated;
grant select (id, thread_id, group_id, author_id, body, links, position, availability, created_at, updated_at)
  on public.thread_replies to authenticated;

-- Explicit projections support SELECT * without exposing request metadata.
create view public.timeline_content with (security_invoker = true) as
  select id, group_id, author_id, kind, body, links, position, availability, created_at, updated_at
  from public.timeline_entries;
create view public.reply_content with (security_invoker = true) as
  select id, thread_id, group_id, author_id, body, links, position, availability, created_at, updated_at
  from public.thread_replies;
revoke all on public.timeline_content, public.reply_content from public, anon, authenticated, service_role;
grant select on public.timeline_content, public.reply_content to authenticated;

create trigger categories_immutable before update on public.categories for each row
  execute function private.guard_record_update('id', 'slug', 'created_at');
create trigger plates_immutable before update on public.plates for each row
  execute function private.guard_record_update('id', 'author_id', 'created_at');
create trigger entries_immutable before update on public.timeline_entries for each row
  execute function private.guard_record_update('id', 'group_id', 'author_id', 'kind', 'position', 'client_request_id', 'request_fingerprint', 'created_at');
create trigger shares_immutable before update on public.plate_shares for each row
  execute function private.guard_record_update('entry_id', 'kind', 'plate_id', 'plate_revision_at_share', 'created_at');
create trigger threads_immutable before update on public.threads for each row
  execute function private.guard_record_update('id', 'root_entry_id', 'group_id', 'root_kind', 'created_at');
create trigger replies_immutable before update on public.thread_replies for each row
  execute function private.guard_record_update('id', 'thread_id', 'group_id', 'author_id', 'position', 'client_request_id', 'request_fingerprint', 'created_at');

create function private.guard_plate_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.revision <> 1 then raise exception 'Initial revision must be 1' using errcode = '23514'; end if;
  else
    if new.revision <> old.revision then raise exception 'Revision is server-owned' using errcode = '23514'; end if;
    if row(new.body, new.links, new.tags, new.category_id, new.availability)
      is distinct from row(old.body, old.links, old.tags, old.category_id, old.availability) then
      new.revision := old.revision + 1;
    end if;
  end if;
  return new;
end $$;
create trigger plates_revision before insert or update on public.plates for each row
  execute function private.guard_plate_revision();

-- Deferred now so M4 can extend this function to ready, audience-checked media
-- and attach the same validation to attachment/asset changes under parent guards.
create function private.check_m2_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare valid boolean;
begin
  if tg_table_name = 'plates' then
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      into valid from public.plates where id = new.id;
  elsif tg_table_name = 'timeline_entries' then
    select availability <> 'available' or kind = 'plate_share' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      into valid from public.timeline_entries where id = new.id;
  else
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      into valid from public.thread_replies where id = new.id;
  end if;
  if valid is distinct from true then
    raise exception 'Available content requires text or a link; media is not enabled yet' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger plates_content after insert or update on public.plates
  deferrable initially deferred for each row execute function private.check_m2_content();
create constraint trigger entries_content after insert or update on public.timeline_entries
  deferrable initially deferred for each row execute function private.check_m2_content();
create constraint trigger replies_content after insert or update on public.thread_replies
  deferrable initially deferred for each row execute function private.check_m2_content();

create function private.check_m2_root()
returns trigger language plpgsql security definer set search_path = '' as $$
declare root_id uuid; root_type text; details bigint; conversations bigint;
begin
  if tg_table_name = 'timeline_entries' then root_id := new.id;
  elsif tg_table_name = 'plate_shares' then root_id := new.entry_id;
  else root_id := new.root_entry_id;
  end if;
  select kind into root_type from public.timeline_entries where id = root_id;
  select count(*) into details from public.plate_shares where entry_id = root_id;
  select count(*) into conversations from public.threads where root_entry_id = root_id;
  if root_type is null or (root_type = 'plate_share' and (details <> 1 or conversations <> 1))
    or (root_type = 'message' and (details <> 0 or conversations <> 0)) then
    raise exception 'Timeline root/detail/thread mismatch' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger entry_root_complete after insert or update on public.timeline_entries
  deferrable initially deferred for each row execute function private.check_m2_root();
create constraint trigger share_root_complete after insert or update on public.plate_shares
  deferrable initially deferred for each row execute function private.check_m2_root();
create constraint trigger thread_root_complete after insert or update on public.threads
  deferrable initially deferred for each row execute function private.check_m2_root();

-- No reparenting or hard deletion; future erasure needs reviewed replacement
-- guards for attribution/fingerprint blanking, never client UPDATE privileges.
create function private.reject_m2_delete()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Hard deletion is not enabled for M2 records' using errcode = '23514'; end $$;
create trigger categories_no_delete before delete on public.categories for each row execute function private.reject_m2_delete();
create trigger plates_no_delete before delete on public.plates for each row execute function private.reject_m2_delete();
create trigger entries_no_delete before delete on public.timeline_entries for each row execute function private.reject_m2_delete();
create trigger shares_no_delete before delete on public.plate_shares for each row execute function private.reject_m2_delete();
create trigger threads_no_delete before delete on public.threads for each row execute function private.reject_m2_delete();
create trigger replies_no_delete before delete on public.thread_replies for each row execute function private.reject_m2_delete();

create function private.lock_content_actor()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id();
begin
  if actor is null then raise exception 'Active sign-in required' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = actor and state = 'active' for share;
  if not found then raise exception 'Active sign-in required' using errcode = '42501'; end if;
  return actor;
end $$;
create function private.validate_m2_input(p_body text, p_links jsonb, p_attachments uuid[], p_empty_ok boolean)
returns void language plpgsql set search_path = '' as $$
begin
  if p_attachments is null or cardinality(p_attachments) <> 0 then
    raise exception 'Media attachments are not enabled yet' using errcode = '23514';
  end if;
  if p_body is null or char_length(p_body) > 20000 or not private.valid_content_links(p_links) then
    raise exception 'Invalid body or links' using errcode = '23514';
  end if;
  if not p_empty_ok and p_body !~ '[^[:space:]]' and jsonb_array_length(p_links) = 0 then
    raise exception 'Content requires text or a link' using errcode = '23514';
  end if;
end $$;

create function public.publish_plate(p_category_id uuid, p_body text default '', p_links jsonb default '[]',
  p_tags jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); result uuid;
begin
  perform private.validate_m2_input(p_body, p_links, p_attachment_ids, false);
  perform 1 from public.categories where id = p_category_id for share;
  if not found then raise exception 'Choose a valid category' using errcode = '23514'; end if;
  insert into public.plates(author_id, category_id, body, links, tags)
    values (actor, p_category_id, p_body, p_links, private.canonical_tags(p_tags)) returning id into result;
  return result;
end $$;
create function public.edit_plate(p_plate_id uuid, p_expected_revision bigint, p_category_id uuid,
  p_body text, p_links jsonb default '[]', p_tags jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); current_plate public.plates%rowtype; result bigint;
begin
  select * into current_plate from public.plates where id = p_plate_id and author_id = actor
    and availability = 'available' for update;
  if not found then raise exception 'Plate not available for editing' using errcode = '42501'; end if;
  if p_expected_revision is distinct from current_plate.revision then
    raise exception 'Plate changed; refresh before editing' using errcode = '40001';
  end if;
  perform private.validate_m2_input(p_body, p_links, p_attachment_ids, false);
  perform 1 from public.categories where id = p_category_id for share;
  if not found then raise exception 'Choose a valid category' using errcode = '23514'; end if;
  update public.plates set category_id = p_category_id, body = p_body, links = p_links,
    tags = private.canonical_tags(p_tags) where id = p_plate_id returning revision into result;
  return result;
end $$;

create function private.append_m2_entry(p_group_id uuid, p_request_id uuid, p_kind text,
  p_plate_id uuid, p_body text, p_links jsonb, p_attachments uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fingerprint text; existing public.timeline_entries%rowtype;
  result uuid; allocated bigint; plate_revision bigint;
begin
  perform 1 from public.groups where id = p_group_id and availability = 'available' for update;
  if not found or not private.is_active_member(p_group_id) then
    raise exception 'Active Table membership required' using errcode = '42501';
  end if;
  if p_request_id is null or p_kind is null or p_kind not in ('message', 'plate_share') then
    raise exception 'Request identity and valid kind required' using errcode = '23514';
  end if;
  if p_kind = 'plate_share' then
    select revision into plate_revision from public.plates
      where id = p_plate_id and availability = 'available' for share;
    if not found then raise exception 'Plate unavailable' using errcode = '42501'; end if;
  elsif p_plate_id is not null then
    raise exception 'A message cannot identify a Plate' using errcode = '23514';
  end if;
  perform private.validate_m2_input(p_body, p_links, p_attachments, p_kind = 'plate_share');
  fingerprint := encode(sha256(convert_to(jsonb_build_array('m2-v1', p_kind, p_group_id,
    p_plate_id, p_body, p_links, to_jsonb(p_attachments))::text, 'UTF8')), 'hex');
  select * into existing from public.timeline_entries
    where author_id = actor and group_id = p_group_id and client_request_id = p_request_id;
  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception 'Request ID already used with different content' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  update public.groups set next_entry_position = next_entry_position + 1 where id = p_group_id
    returning next_entry_position - 1 into allocated;
  insert into public.timeline_entries(group_id, author_id, kind, body, links, position, client_request_id, request_fingerprint)
    values (p_group_id, actor, p_kind, p_body, p_links, allocated, p_request_id, fingerprint) returning id into result;
  if p_kind = 'plate_share' then
    insert into public.plate_shares(entry_id, plate_id, plate_revision_at_share) values (result, p_plate_id, plate_revision);
    insert into public.threads(root_entry_id, group_id, root_kind) values (result, p_group_id, p_kind);
  end if;
  return result;
end $$;
create function public.post_message(p_group_id uuid, p_client_request_id uuid, p_body text default '',
  p_links jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns uuid language sql security definer set search_path = '' as $$
  select private.append_m2_entry(p_group_id, p_client_request_id, 'message', null, p_body, p_links, p_attachment_ids);
$$;
create function public.share_plate(p_group_id uuid, p_plate_id uuid, p_client_request_id uuid,
  p_body text default '', p_links jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns uuid language sql security definer set search_path = '' as $$
  select private.append_m2_entry(p_group_id, p_client_request_id, 'plate_share', p_plate_id, p_body, p_links, p_attachment_ids);
$$;
create function public.reply_to_thread(p_thread_id uuid, p_client_request_id uuid, p_body text default '',
  p_links jsonb default '[]', p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); group_key uuid; root_key uuid; allocated bigint;
  fingerprint text; existing public.thread_replies%rowtype; result uuid;
begin
  select group_id into group_key from public.threads where id = p_thread_id;
  perform 1 from public.groups where id = group_key and availability = 'available' for share;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode = '42501';
  end if;
  select root_entry_id into root_key from public.threads where id = p_thread_id and group_id = group_key for update;
  if not found then raise exception 'Thread unavailable' using errcode = '42501'; end if;
  -- The group SHARE guard excludes entry removal/edit. Plate unpublishing does
  -- not remove this discussion or its replies; no live Plate read is required.
  perform 1 from public.timeline_entries where id = root_key and availability = 'available';
  if not found then raise exception 'Thread unavailable for new replies' using errcode = '42501'; end if;
  if p_client_request_id is null then raise exception 'Request ID required' using errcode = '23514'; end if;
  perform private.validate_m2_input(p_body, p_links, p_attachment_ids, false);
  fingerprint := encode(sha256(convert_to(jsonb_build_array('m2-v1', p_thread_id, p_body,
    p_links, to_jsonb(p_attachment_ids))::text, 'UTF8')), 'hex');
  select * into existing from public.thread_replies
    where author_id = actor and thread_id = p_thread_id and client_request_id = p_client_request_id;
  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception 'Request ID already used with different content' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  update public.threads set next_reply_position = next_reply_position + 1 where id = p_thread_id
    returning next_reply_position - 1 into allocated;
  insert into public.thread_replies(thread_id, group_id, author_id, body, links, position, client_request_id, request_fingerprint)
    values (p_thread_id, group_key, actor, p_body, p_links, allocated, p_client_request_id, fingerprint) returning id into result;
  return result;
end $$;

create function public.edit_timeline_entry(p_entry_id uuid, p_body text, p_links jsonb default '[]',
  p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); group_key uuid; entry public.timeline_entries%rowtype;
begin
  select group_id into group_key from public.timeline_entries where id = p_entry_id;
  perform 1 from public.groups where id = group_key and availability = 'available' for update;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode = '42501';
  end if;
  select * into entry from public.timeline_entries where id = p_entry_id and group_id = group_key
    and author_id = actor and availability = 'available' for update;
  if not found then raise exception 'Entry not available for editing' using errcode = '42501'; end if;
  perform private.validate_m2_input(p_body, p_links, p_attachment_ids, entry.kind = 'plate_share');
  update public.timeline_entries set body = p_body, links = p_links where id = p_entry_id;
  return p_entry_id;
end $$;
create function public.edit_thread_reply(p_reply_id uuid, p_body text, p_links jsonb default '[]',
  p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); group_key uuid; thread_key uuid;
begin
  select group_id, thread_id into group_key, thread_key from public.thread_replies where id = p_reply_id;
  perform 1 from public.groups where id = group_key and availability = 'available' for share;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode = '42501';
  end if;
  perform 1 from public.threads where id = thread_key and group_id = group_key for update;
  if not found then raise exception 'Thread unavailable' using errcode = '42501'; end if;
  perform 1 from public.thread_replies where id = p_reply_id and thread_id = thread_key
    and group_id = group_key and author_id = actor and availability = 'available' for update;
  if not found then raise exception 'Reply not available for editing' using errcode = '42501'; end if;
  perform private.validate_m2_input(p_body, p_links, p_attachment_ids, false);
  update public.thread_replies set body = p_body, links = p_links where id = p_reply_id;
  return p_reply_id;
end $$;

-- Private M1 default privileges already deny client execution; explicit revokes
-- here also document the boundary without disturbing the M1 policy helpers.
revoke all on function private.valid_content_links(jsonb), private.canonical_tags(jsonb),
  private.guard_plate_revision(), private.check_m2_content(), private.check_m2_root(),
  private.reject_m2_delete(), private.lock_content_actor(),
  private.validate_m2_input(text,jsonb,uuid[],boolean),
  private.append_m2_entry(uuid,uuid,text,uuid,text,jsonb,uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.publish_plate(uuid,text,jsonb,jsonb,uuid[]),
  public.edit_plate(uuid,bigint,uuid,text,jsonb,jsonb,uuid[]),
  public.post_message(uuid,uuid,text,jsonb,uuid[]), public.share_plate(uuid,uuid,uuid,text,jsonb,uuid[]),
  public.reply_to_thread(uuid,uuid,text,jsonb,uuid[]), public.edit_timeline_entry(uuid,text,jsonb,uuid[]),
  public.edit_thread_reply(uuid,text,jsonb,uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.publish_plate(uuid,text,jsonb,jsonb,uuid[]),
  public.edit_plate(uuid,bigint,uuid,text,jsonb,jsonb,uuid[]),
  public.post_message(uuid,uuid,text,jsonb,uuid[]), public.share_plate(uuid,uuid,uuid,text,jsonb,uuid[]),
  public.reply_to_thread(uuid,uuid,text,jsonb,uuid[]), public.edit_timeline_entry(uuid,text,jsonb,uuid[]),
  public.edit_thread_reply(uuid,text,jsonb,uuid[]) to authenticated;
commit;
