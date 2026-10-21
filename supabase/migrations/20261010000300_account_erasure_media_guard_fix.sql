-- Correct the media insertion guard after the account-erasure migration.
-- PL/pgSQL can evaluate a condition's table-specific field before its table-name check.
begin;
create or replace function private.guard_erasure_media_insert()
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
    if tg_table_name = 'table_media_assets' then
      if not exists (
        select 1 from public.group_memberships m join public.groups g on g.id = m.group_id
        where m.group_id = new.group_id and m.user_id = owner_key
          and m.state = 'active' and g.availability = 'available') then
        raise exception 'Table membership unavailable' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
commit;
