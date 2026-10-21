-- Formal Table Requests: one private root/thread and a live Menu reference.
-- No record removal, invitation, media or Feed Request operation is enabled.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run the Request migration with the local migration role postgres';
  end if;
end $$;

alter table public.timeline_entries drop constraint timeline_entries_kind_check;
alter table public.timeline_entries add constraint timeline_entries_kind_check
  check (kind in ('message', 'plate_share', 'request'));
alter table public.threads drop constraint threads_root_kind_check;
alter table public.threads add constraint threads_root_kind_check
  check (root_kind in ('plate_share', 'request'));

create table public.requests (
  entry_id uuid primary key,
  kind text not null default 'request' check (kind = 'request'),
  question text not null check (char_length(question) between 1 and 500
    and question ~ '[^[:space:]]' and question !~ '[[:cntrl:]]'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (entry_id, kind) references public.timeline_entries(id, kind)
    on update restrict on delete restrict
);
revoke all on public.requests from public, anon, authenticated, service_role;
alter table public.requests enable row level security;
create policy requests_member_read on public.requests for select to authenticated
  using (exists (select 1 from public.timeline_entries e where e.id = entry_id));
grant select (entry_id, kind, question, created_at) on public.requests to authenticated;
create trigger requests_immutable before update on public.requests for each row
  execute function private.guard_record_update('entry_id', 'kind', 'question', 'created_at');
create trigger requests_no_delete before delete on public.requests for each row
  execute function private.reject_m2_delete();

create or replace function private.check_m2_content()
returns trigger language plpgsql security definer set search_path = '' as $$
declare valid boolean;
begin
  if tg_table_name = 'plates' then
    select availability <> 'available' or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
      into valid from public.plates where id = new.id;
  elsif tg_table_name = 'timeline_entries' then
    select availability <> 'available' or kind in ('plate_share', 'request')
      or body ~ '[^[:space:]]' or jsonb_array_length(links) > 0
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

create or replace function private.check_m2_root()
returns trigger language plpgsql security definer set search_path = '' as $$
declare root_id uuid; root_type text; shares bigint; request_details bigint; conversations bigint;
begin
  if tg_table_name = 'timeline_entries' then root_id := new.id;
  elsif tg_table_name in ('plate_shares', 'requests') then root_id := new.entry_id;
  else root_id := new.root_entry_id;
  end if;
  select kind into root_type from public.timeline_entries where id = root_id;
  select count(*) into shares from public.plate_shares where entry_id = root_id;
  select count(*) into request_details from public.requests where entry_id = root_id;
  select count(*) into conversations from public.threads where root_entry_id = root_id;
  if root_type is null or (root_type = 'plate_share' and (shares <> 1 or request_details <> 0 or conversations <> 1))
    or (root_type = 'request' and (shares <> 0 or request_details <> 1 or conversations <> 1))
    or (root_type = 'message' and (shares <> 0 or request_details <> 0 or conversations <> 0)) then
    raise exception 'Timeline root/detail/thread mismatch' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger request_root_complete after insert or update on public.requests
  deferrable initially deferred for each row execute function private.check_m2_root();

create function public.post_table_request(p_group_id uuid, p_client_request_id uuid,
  p_question text, p_context text default '', p_links jsonb default '[]',
  p_attachment_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fingerprint text;
  existing public.timeline_entries%rowtype; result uuid; allocated bigint;
begin
  perform 1 from public.groups where id = p_group_id and availability = 'available' for update;
  if not found or not private.is_active_member(p_group_id) then
    raise exception 'Active Table membership required' using errcode = '42501';
  end if;
  if p_client_request_id is null or p_question is null or char_length(p_question) not between 1 and 500
    or p_question !~ '[^[:space:]]' or p_question ~ '[[:cntrl:]]' then
    raise exception 'A question of 1–500 characters is required' using errcode = '23514';
  end if;
  perform private.validate_m2_input(p_context, p_links, p_attachment_ids, true);
  fingerprint := encode(sha256(convert_to(jsonb_build_array('request-v1', p_group_id,
    p_question, p_context, p_links, to_jsonb(p_attachment_ids))::text, 'UTF8')), 'hex');
  select * into existing from public.timeline_entries
    where author_id = actor and group_id = p_group_id and client_request_id = p_client_request_id;
  if found then
    if existing.kind <> 'request' or existing.request_fingerprint is distinct from fingerprint then
      raise exception 'Request ID already used with different content' using errcode = '23505';
    end if;
    return existing.id;
  end if;
  update public.groups set next_entry_position = next_entry_position + 1 where id = p_group_id
    returning next_entry_position - 1 into allocated;
  insert into public.timeline_entries(group_id, author_id, kind, body, links, position,
    client_request_id, request_fingerprint)
    values (p_group_id, actor, 'request', p_context, p_links, allocated,
      p_client_request_id, fingerprint) returning id into result;
  insert into public.requests(entry_id, question) values (result, p_question);
  insert into public.threads(root_entry_id, group_id, root_kind)
    values (result, p_group_id, 'request');
  return result;
end $$;
revoke all on function public.post_table_request(uuid,uuid,text,text,jsonb,uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.post_table_request(uuid,uuid,text,text,jsonb,uuid[]) to authenticated;

create table public.menu_request_saves (
  id uuid primary key default gen_random_uuid(),
  saver_id uuid not null references public.profiles(id) on update restrict on delete restrict,
  request_entry_id uuid not null references public.requests(entry_id) on update restrict on delete restrict,
  saved_at timestamptz not null default clock_timestamp() check (isfinite(saved_at)),
  unique (saver_id, request_entry_id)
);
create index menu_request_saves_owner_time on public.menu_request_saves(saver_id, saved_at desc, id);
revoke all on public.menu_request_saves from public, anon, authenticated, service_role;
alter table public.menu_request_saves enable row level security;
create policy menu_request_saves_owner_read on public.menu_request_saves for select to authenticated
  using (saver_id = (select private.current_profile_id()));
grant select (id, saver_id, request_entry_id, saved_at) on public.menu_request_saves to authenticated;
create trigger menu_request_saves_immutable before update on public.menu_request_saves for each row
  execute function private.guard_record_update('id', 'saver_id', 'request_entry_id', 'saved_at');
create trigger menu_request_saves_no_delete before delete on public.menu_request_saves for each row
  execute function private.reject_menu_delete();

-- The saver retains only an ID if Table membership later ends. The invoker
-- joins reveal question, context and Table details only under current RLS.
create view public.menu_request_context with (security_invoker = true) as
  select s.id as save_id, s.request_entry_id, s.saved_at,
    e.group_id, g.name as group_name, e.author_id as asker_id,
    p.display_name as asker_name, r.question, e.body as context, e.links,
    t.id as thread_id, (t.id is not null) as source_available
  from public.menu_request_saves s
  left join public.timeline_entries e on e.id = s.request_entry_id and e.availability = 'available'
  left join public.requests r on r.entry_id = e.id
  left join public.groups g on g.id = e.group_id
  left join public.profiles p on p.id = e.author_id
  left join public.threads t on t.root_entry_id = e.id and t.group_id = e.group_id;
revoke all on public.menu_request_context from public, anon, authenticated, service_role;
grant select on public.menu_request_context to authenticated;

create function public.save_table_request(p_request_entry_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); group_key uuid; result uuid;
begin
  select group_id into group_key from public.timeline_entries
    where id = p_request_entry_id and kind = 'request';
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
  perform 1 from public.groups where id = group_key and availability = 'available' for share;
  if not found or not private.is_active_member(group_key) then
    raise exception 'Active Table membership required' using errcode = '42501';
  end if;
  perform 1 from public.timeline_entries e join public.requests r on r.entry_id = e.id
    join public.threads t on t.root_entry_id = e.id and t.group_id = e.group_id
    where e.id = p_request_entry_id and e.group_id = group_key and e.availability = 'available';
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
  insert into public.menu_request_saves(saver_id, request_entry_id)
    values (actor, p_request_entry_id) on conflict (saver_id, request_entry_id) do nothing
    returning id into result;
  if result is null then
    select id into result from public.menu_request_saves
      where saver_id = actor and request_entry_id = p_request_entry_id;
  end if;
  return result;
end $$;
revoke all on function public.save_table_request(uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_table_request(uuid) to authenticated;
commit;
