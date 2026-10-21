-- Read-only self-erasure preflight. No erasure or cleanup operation is enabled.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run the erasure preflight migration with the local migration role postgres';
  end if;
end $$;

create function public.account_erasure_impact()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.current_profile_id();
begin
  if actor is null then
    raise exception 'Active sign-in required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'authored_plates', (select count(*) from public.plates where author_id = actor),
    'authored_table_entries', (select count(*) from public.timeline_entries where author_id = actor),
    'authored_requests', (select count(*) from public.timeline_entries
      where author_id = actor and kind = 'request'),
    'authored_replies', (select count(*) from public.thread_replies where author_id = actor),
    'copied_plate_saves', (select count(*) from public.menu_plate_saves s
      join public.plates p on p.id = s.plate_id where p.author_id = actor),
    'own_plate_saves', (select count(*) from public.menu_plate_saves where saver_id = actor),
    'own_request_saves', (select count(*) from public.menu_request_saves where saver_id = actor),
    'owned_tables', (select count(*) from public.group_memberships m
      join public.groups g on g.id = m.group_id
      where m.user_id = actor and m.state = 'active' and m.role = 'owner'
        and g.availability = 'available'),
    'sole_owner_tables', (select count(*) from public.group_memberships m
      join public.groups g on g.id = m.group_id
      where m.user_id = actor and m.state = 'active' and m.role = 'owner'
        and g.availability = 'available' and not exists (
          select 1 from public.group_memberships other
          where other.group_id = m.group_id and other.user_id <> actor
            and other.state = 'active' and other.role = 'owner')),
    'sole_owner_table_details', coalesce((select jsonb_agg(
      jsonb_build_object('id', g.id, 'name', g.name,
        'other_active_members', (select count(*) from public.group_memberships member
          where member.group_id = g.id and member.user_id <> actor and member.state = 'active'))
      order by g.name, g.id)
      from public.group_memberships m join public.groups g on g.id = m.group_id
      where m.user_id = actor and m.state = 'active' and m.role = 'owner'
        and g.availability = 'available' and not exists (
          select 1 from public.group_memberships other
          where other.group_id = m.group_id and other.user_id <> actor
            and other.state = 'active' and other.role = 'owner')), '[]'::jsonb),
    'created_tables', (select count(*) from public.groups g
      where g.created_by = actor and g.availability <> 'erased'),
    'plate_upload_attempts', (select count(*) from public.media_upload_intents where uploader_id = actor),
    'plate_photo_objects', (select count(*) from public.media_assets where uploader_id = actor),
    'table_upload_attempts', (select count(*) from public.table_upload_intents where uploader_id = actor),
    'table_photo_objects', (select count(*) from public.table_media_assets where uploader_id = actor),
    'derived_preview_objects', (select count(*) from public.menu_preview_assets a
      where a.saver_id = actor or exists (
        select 1 from public.plates p where p.id = a.plate_id and p.author_id = actor))
  );
end $$;
revoke all on function public.account_erasure_impact() from public, anon, authenticated, service_role;
grant execute on function public.account_erasure_impact() to authenticated;
commit;
