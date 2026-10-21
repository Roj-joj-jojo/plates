begin read only;
set local statement_timeout='5s';
set local lock_timeout='3s';
do $$ begin
  if to_regclass('private.introduction_preferences') is not null
    or to_regprocedure('public.my_introduction_completed()') is not null
    or to_regprocedure('public.complete_introduction()') is not null then
    raise exception 'Introduction candidate already present or partial; inspect first' using errcode='P7501';
  end if;
  if to_regprocedure('private.current_profile_id()') is null
    or to_regprocedure('public.begin_recorded_account_erasure(uuid,jsonb)') is null then
    raise exception 'Expected identity/erasure prerequisite missing' using errcode='P7503';
  end if;
  if exists(select 1 from private.photo_worker_control where active_run is not null)
    or exists(select 1 from private.photo_worker_journal where phase not in ('complete','rejected'))
    or exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Active or unfinished photo work; activation refused' using errcode='P7502';
  end if;
end $$;
select 'PASS Introduction preflight: candidate absent, identity/erasure installed, photo work clear';
rollback;
