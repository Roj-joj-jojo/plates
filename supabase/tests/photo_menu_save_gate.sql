-- Run inside a transaction after the M4a follow-up migration, then roll back.
set local statement_timeout = '15s';
create function pg_temp.expect_photo_gate(p_plate uuid, p_revision bigint)
returns void language plpgsql as $$
declare actual text;
begin
  begin
    perform public.save_plate(p_plate, p_revision, null, null);
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = '23514' then return; end if;
    raise exception 'Expected photo preview gate, got %: %', actual, sqlerrm;
  end;
  raise exception 'Photo Plate was saved without a preview';
end $$;
do $$
declare image_plate record; auth_key uuid; text_plate uuid; saved uuid;
begin
  select p.id, p.revision, p.author_id into image_plate from public.plates p
    where p.body = 'Local image smoke test'
      and exists (select 1 from public.plate_media pm where pm.plate_id = p.id)
      and not exists (select 1 from public.menu_plate_saves s where s.plate_id = p.id)
    order by p.created_at desc limit 1;
  if not found then raise exception 'No unsaved local synthetic photo Plate is available'; end if;
  select auth_user_id into auth_key from private.profile_auth_links
    where profile_id = image_plate.author_id;
  perform set_config('request.jwt.claim.sub', auth_key::text, true);
  execute 'set local role authenticated';
  perform pg_temp.expect_photo_gate(image_plate.id, image_plate.revision);
  text_plate := public.publish_plate((select id from public.categories where slug = 'meal'),
    'Rollback-only text Menu save check');
  saved := public.save_plate(text_plate, 1, null, null);
  if saved is null then raise exception 'Text Plate save failed'; end if;
  execute 'reset role';
end $$;
select 'PASS: photo Menu first-save gate; text saves remain available' as result;
