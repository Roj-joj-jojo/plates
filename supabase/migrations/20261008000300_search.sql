-- Initial literal keyword search. Queries run with the caller's RLS rights.
-- No separate index, external engine, media search or cross-Table result set.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run the search migration with the local migration role postgres';
  end if;
end $$;

create function public.search_plates(p_query text)
returns table(id uuid, author_id uuid, author_name text, category_label text,
  body text, links jsonb, created_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare term text;
begin
  term := pg_catalog.normalize(lower(btrim(regexp_replace(p_query, '[[:space:]]+', ' ', 'g'))), 'NFC');
  if term is null or char_length(term) not between 1 and 100 or term ~ '[[:cntrl:]]' then
    raise exception 'Search for 1–100 characters' using errcode = '23514';
  end if;
  return query
    select p.id, p.author_id, pr.display_name, c.label, p.body, p.links, p.created_at
    from public.plates p
    left join public.profiles pr on pr.id = p.author_id
    join public.categories c on c.id = p.category_id
    where p.availability = 'available' and (
      position(term in lower(p.body)) > 0
      or position(term in lower(coalesce(pr.display_name, ''))) > 0
      or position(term in lower(c.label)) > 0
      or exists (select 1 from jsonb_array_elements_text(p.links) as link(value)
        where position(term in lower(link.value)) > 0)
      or exists (select 1 from jsonb_array_elements_text(p.tags) as tag(value)
        where position(term in tag.value) > 0)
    )
    order by p.created_at desc, p.id desc limit 50;
end $$;

create function public.search_table(p_group_id uuid, p_query text)
returns table(kind text, root_kind text, entry_id uuid, reply_id uuid,
  author_id uuid, author_name text, body text, links jsonb, question text,
  plate_id uuid, occurred_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare term text;
begin
  term := pg_catalog.normalize(lower(btrim(regexp_replace(p_query, '[[:space:]]+', ' ', 'g'))), 'NFC');
  if term is null or char_length(term) not between 1 and 100 or term ~ '[[:cntrl:]]' then
    raise exception 'Search for 1–100 characters' using errcode = '23514';
  end if;
  perform 1 from public.groups g where g.id = p_group_id and g.availability = 'available';
  if not found then raise exception 'Active Table membership required' using errcode = '42501'; end if;
  return query
    with hits as (
      select e.kind, e.kind as root_kind, e.id as entry_id, null::uuid as reply_id,
        e.author_id, pr.display_name as author_name, e.body, e.links,
        rq.question, ps.plate_id, e.created_at as occurred_at
      from public.timeline_entries e
      left join public.profiles pr on pr.id = e.author_id
      left join public.requests rq on rq.entry_id = e.id
      left join public.plate_shares ps on ps.entry_id = e.id
      left join public.plates p on p.id = ps.plate_id and p.availability = 'available'
      where e.group_id = p_group_id and e.availability = 'available' and (
        position(term in lower(e.body)) > 0
        or position(term in lower(coalesce(pr.display_name, ''))) > 0
        or position(term in lower(coalesce(rq.question, ''))) > 0
        or position(term in lower(coalesce(p.body, ''))) > 0
        or exists (select 1 from jsonb_array_elements_text(e.links) as link(value)
          where position(term in lower(link.value)) > 0)
        or exists (select 1 from jsonb_array_elements_text(coalesce(p.links, '[]'::jsonb)) as link(value)
          where position(term in lower(link.value)) > 0)
        or exists (select 1 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as tag(value)
          where position(term in tag.value) > 0)
      )
      union all
      select 'reply'::text, e.kind, e.id, r.id, r.author_id, pr.display_name,
        r.body, r.links, rq.question, null::uuid, r.created_at
      from public.thread_replies r
      join public.threads t on t.id = r.thread_id and t.group_id = r.group_id
      join public.timeline_entries e on e.id = t.root_entry_id and e.group_id = t.group_id
      left join public.requests rq on rq.entry_id = e.id
      left join public.profiles pr on pr.id = r.author_id
      where r.group_id = p_group_id and r.availability = 'available'
        and e.availability = 'available' and (
          position(term in lower(r.body)) > 0
          or position(term in lower(coalesce(pr.display_name, ''))) > 0
          or exists (select 1 from jsonb_array_elements_text(r.links) as link(value)
            where position(term in lower(link.value)) > 0)
        )
    )
    select h.kind, h.root_kind, h.entry_id, h.reply_id, h.author_id, h.author_name,
      h.body, h.links, h.question, h.plate_id, h.occurred_at
    from hits h order by h.occurred_at desc, h.entry_id desc, h.reply_id desc limit 50;
end $$;

create function public.search_menu(p_query text)
returns table(save_type text, save_id uuid)
language plpgsql security invoker set search_path = '' as $$
declare term text;
begin
  term := pg_catalog.normalize(lower(btrim(regexp_replace(p_query, '[[:space:]]+', ' ', 'g'))), 'NFC');
  if term is null or char_length(term) not between 1 and 100 or term ~ '[[:cntrl:]]' then
    raise exception 'Search for 1–100 characters' using errcode = '23514';
  end if;
  return query
    with hits as (
      select 'plate'::text as save_type, s.id as save_id, s.saved_at
      from public.menu_plate_saves s
      where s.availability = 'available' and (
        position(term in lower(s.snapshot_body)) > 0
        or position(term in lower(s.snapshot_author_name)) > 0
        or position(term in lower(s.snapshot_category_label)) > 0
        or exists (select 1 from jsonb_array_elements_text(s.snapshot_links) as link(value)
          where position(term in lower(link.value)) > 0)
        or exists (select 1 from jsonb_array_elements_text(s.snapshot_tags) as tag(value)
          where position(term in tag.value) > 0)
      )
      union all
      select 'request'::text, s.id, s.saved_at
      from public.menu_request_saves s
      join public.timeline_entries e on e.id = s.request_entry_id and e.availability = 'available'
      join public.requests rq on rq.entry_id = e.id
      join public.groups g on g.id = e.group_id and g.availability = 'available'
      left join public.profiles pr on pr.id = e.author_id
      where position(term in lower(rq.question)) > 0
        or position(term in lower(e.body)) > 0
        or position(term in lower(g.name)) > 0
        or position(term in lower(coalesce(pr.display_name, ''))) > 0
        or exists (select 1 from jsonb_array_elements_text(e.links) as link(value)
          where position(term in lower(link.value)) > 0)
    )
    select h.save_type, h.save_id from hits h
    order by h.saved_at desc, h.save_id desc limit 50;
end $$;

revoke all on function public.search_plates(text), public.search_table(uuid,text),
  public.search_menu(text) from public, anon, authenticated, service_role;
grant execute on function public.search_plates(text), public.search_table(uuid,text),
  public.search_menu(text) to authenticated;
commit;
