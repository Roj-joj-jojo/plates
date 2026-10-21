-- Candidate only. Reversible organisation; no content/object deletion or cleanup.
begin;
alter table public.menu_plate_saves
  add column removed_at timestamptz check(removed_at is null or isfinite(removed_at)),
  add column menu_version bigint not null default 0 check(menu_version>=0);
alter table public.menu_request_saves
  add column removed_at timestamptz check(removed_at is null or isfinite(removed_at)),
  add column menu_version bigint not null default 0 check(menu_version>=0),
  add column updated_at timestamptz not null default clock_timestamp();
grant select(removed_at,menu_version) on public.menu_plate_saves,public.menu_request_saves to authenticated;

create or replace view public.menu_request_context with (security_invoker=true) as
  select s.id as save_id,s.request_entry_id,s.saved_at,
    e.group_id,g.name as group_name,e.author_id as asker_id,
    p.display_name as asker_name,r.question,e.body as context,e.links,
    t.id as thread_id,(t.id is not null) as source_available,s.removed_at,s.menu_version
  from public.menu_request_saves s
  left join public.timeline_entries e on e.id=s.request_entry_id and e.availability='available'
  left join public.requests r on r.entry_id=e.id
  left join public.groups g on g.id=e.group_id
  left join public.profiles p on p.id=e.author_id
  left join public.threads t on t.root_entry_id=e.id and t.group_id=e.group_id;

create function public.menu_removal_ready() returns boolean
language sql stable set search_path='' as $$ select true $$;

create function public.set_menu_item_removed(p_kind text,p_save_id uuid,p_removed boolean,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); current_removed timestamptz; current_version bigint;
begin
  perform 1 from public.profiles where id=actor and state='active' for share;
  if not found then raise exception 'Active sign-in required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('plate','request') or p_save_id is null
    or p_removed is null or p_expected_version is null or p_expected_version<0 then
    raise exception 'Choose a saved item and action' using errcode='23514'; end if;
  if p_kind='plate' then
    select removed_at,menu_version into current_removed,current_version from public.menu_plate_saves
      where id=p_save_id and saver_id=actor and availability='available' for update;
  else
    select removed_at,menu_version into current_removed,current_version from public.menu_request_saves
      where id=p_save_id and saver_id=actor for update;
  end if;
  if not found then raise exception 'Saved item unavailable' using errcode='42501'; end if;
  if current_version=p_expected_version+1 and (current_removed is not null)=p_removed then return current_version; end if;
  if current_version<>p_expected_version then raise exception 'Saved item changed; refresh' using errcode='40001'; end if;
  if (current_removed is not null)=p_removed then return current_version; end if;
  if p_kind='plate' then
    update public.menu_plate_saves set removed_at=case when p_removed then clock_timestamp() else null end,
      menu_version=menu_version+1 where id=p_save_id;
  else
    update public.menu_request_saves set removed_at=case when p_removed then clock_timestamp() else null end,
      menu_version=menu_version+1 where id=p_save_id;
  end if;
  perform private.bump_account(actor);
  return current_version+1;
end $$;

-- Source-page controls can restore the exact saved copy without preparing new previews.
create function public.saved_menu_item_state(p_kind text,p_source_id uuid)
returns table(save_id uuid,removed_at timestamptz,menu_version bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_kind='plate' then
    return query select s.id,s.removed_at,s.menu_version from public.menu_plate_saves s
      where s.saver_id=private.current_profile_id() and s.plate_id=p_source_id and s.availability='available';
  elsif p_kind='request' then
    return query select s.id,s.removed_at,s.menu_version from public.menu_request_saves s
      where s.saver_id=private.current_profile_id() and s.request_entry_id=p_source_id;
  else raise exception 'Choose a saved item type' using errcode='23514'; end if;
end $$;

create function public.search_menu_items(p_query text,p_removed boolean default false)
returns table(save_type text,save_id uuid)
language plpgsql security invoker set search_path='' as $$
declare term text;
begin
  term:=pg_catalog.normalize(lower(btrim(regexp_replace(p_query,'[[:space:]]+',' ','g'))),'NFC');
  if term is null or char_length(term) not between 1 and 100 or term ~ '[[:cntrl:]]' or p_removed is null then
    raise exception 'Search for 1–100 characters' using errcode='23514'; end if;
  return query with hits as (
    select 'plate'::text as save_type,s.id as save_id,s.saved_at from public.menu_plate_saves s
      where s.availability='available' and (s.removed_at is not null)=p_removed and (
        position(term in lower(s.snapshot_body))>0 or position(term in lower(s.snapshot_author_name))>0
        or position(term in lower(s.snapshot_category_label))>0
        or exists(select 1 from jsonb_array_elements_text(s.snapshot_links) link(value) where position(term in lower(link.value))>0)
        or exists(select 1 from jsonb_array_elements_text(s.snapshot_tags) tag(value) where position(term in tag.value)>0))
    union all
    select 'request'::text,s.id,s.saved_at from public.menu_request_saves s
      join public.timeline_entries e on e.id=s.request_entry_id and e.availability='available'
      join public.requests rq on rq.entry_id=e.id
      join public.groups g on g.id=e.group_id and g.availability='available'
      left join public.profiles pr on pr.id=e.author_id
      where (s.removed_at is not null)=p_removed and (position(term in lower(rq.question))>0
        or position(term in lower(e.body))>0 or position(term in lower(g.name))>0
        or position(term in lower(coalesce(pr.display_name,'')))>0
        or exists(select 1 from jsonb_array_elements_text(e.links) link(value) where position(term in lower(link.value))>0))
  ) select h.save_type,h.save_id from hits h order by h.saved_at desc,h.save_id desc limit 50;
end $$;
create or replace function public.search_menu(p_query text)
returns table(save_type text,save_id uuid)
language sql stable security invoker set search_path='' as $$
  select * from public.search_menu_items(p_query,false);
$$;
revoke all on function public.menu_removal_ready(),public.set_menu_item_removed(text,uuid,boolean,bigint),
  public.saved_menu_item_state(text,uuid),public.search_menu_items(text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.menu_removal_ready(),public.set_menu_item_removed(text,uuid,boolean,bigint),
  public.saved_menu_item_state(text,uuid),public.search_menu_items(text,boolean) to authenticated;
-- Existing immutable snapshot/no-delete guards and erasure availability remain in force.
commit;
