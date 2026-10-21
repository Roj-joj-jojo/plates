-- Read-only local activation preflight. No credentials, content or profile IDs selected.
begin read only;
set local statement_timeout='5s';
set local lock_timeout='3s';
do $$ begin
  if to_regclass('private.plate_likes') is not null or to_regclass('private.plate_comments') is not null
    or to_regclass('private.plate_comment_notifications') is not null
    or to_regprocedure('public.plate_interactions_ready()') is not null then
    raise exception 'Interaction candidate already present or partial; inspect first' using errcode='P7501'; end if;
  if to_regclass('private.follow_edges') is null then
    raise exception 'Expected following/privacy prerequisite missing' using errcode='P7503'; end if;
  if exists(select 1 from private.photo_worker_control where active_run is not null)
    or exists(select 1 from private.photo_worker_journal where phase not in ('complete','rejected'))
    or exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Active or unfinished photo work; activation refused' using errcode='P7502'; end if;
end $$;
select 'PASS Plate interaction preflight: candidate absent, privacy installed, photo work clear';
rollback;
