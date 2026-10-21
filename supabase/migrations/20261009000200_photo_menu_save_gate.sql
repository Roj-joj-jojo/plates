-- M4a follow-up: prevent first Menu saves of photo Plates until per-saver
-- previews exist. Existing reminders and later source links remain intact.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run the local media guard with migration role postgres';
  end if;
end $$;

create function private.require_photo_preview_before_menu_save()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.plate_media where plate_id = new.plate_id) then
    raise exception 'Saving photo Plates needs a private Menu preview first' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger menu_photo_preview_required before insert on public.menu_plate_saves
  for each row execute function private.require_photo_preview_before_menu_save();
revoke all on function private.require_photo_preview_before_menu_save()
  from public, anon, authenticated, service_role;
commit;
