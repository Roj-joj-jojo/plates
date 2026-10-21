-- Read-only local activation preflight; no credentials or content selected.
begin read only;
set local statement_timeout='5s';
set local lock_timeout='3s';
do $$ begin
  if to_regclass('private.follow_notifications') is not null
    or to_regclass('private.menu_preview_batches') is not null
    or to_regclass('private.menu_saved_photos') is not null then
    raise exception 'Candidate already present; inspect before proceeding' using errcode='P7501'; end if;
  if exists(select 1 from private.photo_worker_control where active_run is not null)
    or exists(select 1 from private.photo_worker_journal where phase not in ('complete','rejected'))
    or exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Active or unfinished photo work; activation refused' using errcode='P7502'; end if;
end $$;
select 'PASS social Menu preflight: candidates absent and photo ownership/processing clear';
rollback;
