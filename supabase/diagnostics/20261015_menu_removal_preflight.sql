-- Read-only activation preflight. No content, IDs or credentials displayed.
begin read only;
set local statement_timeout='5s';
set local lock_timeout='3s';
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name in ('menu_plate_saves','menu_request_saves') and column_name in ('removed_at','menu_version')) then
    raise exception 'Removal candidate already present or partial; inspect first' using errcode='P7501'; end if;
  if to_regclass('private.menu_saved_photos') is null then
    raise exception 'Expected installed gallery prerequisite missing' using errcode='P7503'; end if;
  if exists(select 1 from private.photo_worker_control where active_run is not null)
    or exists(select 1 from private.photo_worker_journal where phase not in ('complete','rejected'))
    or exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Active or unfinished photo work; activation refused' using errcode='P7502'; end if;
end $$;
select 'PASS Menu removal preflight: candidate absent, gallery installed, photo work clear';
rollback;
