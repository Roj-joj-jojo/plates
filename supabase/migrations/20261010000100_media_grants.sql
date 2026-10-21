-- Narrow media table grants; keep the existing RLS policies and worker access.
-- No records or Storage objects are changed.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run media grants migration with the local migration role postgres';
  end if;
end $$;

revoke all on public.media_upload_intents, public.media_assets, public.plate_media,
  public.table_upload_intents, public.table_media_assets, public.entry_media,
  public.reply_media, public.menu_preview_jobs, public.menu_preview_assets
  from public, anon, authenticated, service_role;

grant select (id, state, asset_id, error_message, created_at)
  on public.media_upload_intents, public.table_upload_intents to authenticated;
grant select (id, media_type, width, height)
  on public.media_assets, public.table_media_assets to authenticated;
grant select (plate_id, asset_id, position) on public.plate_media to authenticated;
grant select (entry_id, group_id, asset_id, position) on public.entry_media to authenticated;
grant select (reply_id, asset_id, position) on public.reply_media to authenticated;
grant select (id, state, preview_asset_id, error_message, created_at)
  on public.menu_preview_jobs to authenticated;
grant select (id, width, height) on public.menu_preview_assets to authenticated;

grant select, insert, update on public.media_upload_intents, public.media_assets,
  public.plate_media, public.table_upload_intents, public.table_media_assets,
  public.menu_preview_jobs, public.menu_preview_assets to service_role;

revoke all on function private.validate_plate_images(uuid[],uuid,uuid)
  from public, anon, authenticated, service_role;
commit;
