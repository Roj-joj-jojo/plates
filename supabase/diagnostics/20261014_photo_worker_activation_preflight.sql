-- Read-only prerequisite check; no installation or worker start.
begin read only;
set local statement_timeout='5s';
set local lock_timeout='3s';
select to_regclass('private.photo_worker_control') is null as candidate_not_installed,
  (select count(*) from public.media_upload_intents where state='processing') as plate_processing,
  (select count(*) from public.table_upload_intents where state='processing') as table_processing,
  (select count(*) from public.menu_preview_jobs where state='processing') as preview_processing;
rollback;
