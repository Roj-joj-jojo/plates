-- Metadata-only ownership tests. No Storage/Auth API, queue processing or deletion.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';

create function pg_temp.photo_assert(ok boolean, label text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'Photo ownership assertion: %',label; end if;
end $$;
create function pg_temp.photo_expect(query text, expected text) returns void
language plpgsql as $$ begin
  begin
    execute query;
  exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;

select pg_temp.photo_assert(not has_function_privilege('authenticated','public.photo_worker_ready()','EXECUTE'),'reader cannot run worker');
select pg_temp.photo_assert(not has_table_privilege('service_role','private.photo_worker_journal','SELECT'),'journal is RPC-only');
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.photo_expect('select public.photo_worker_ready()','42501');
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.photo_assert(public.photo_worker_ready()=1,'schema ready');

-- Refuse rather than altering any existing processing work.
do $$ begin
  if exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Existing photo processing work; ownership tests refused' using errcode='P7501';
  end if;
end $$;

do $$
declare first_run uuid:=gen_random_uuid(); next_run uuid:=gen_random_uuid();
  test_job uuid:=gen_random_uuid(); test_asset uuid:=gen_random_uuid();
begin
  perform public.photo_worker_open(first_run);
  perform public.photo_worker_open(first_run);
  perform pg_temp.photo_expect(format('select public.photo_worker_open(%L::uuid)',next_run),'23514');
  perform pg_temp.photo_expect(format('select public.photo_worker_poll(%L::uuid)',next_run),'40001');
  perform pg_temp.photo_expect(format('select public.photo_worker_claim(%L::uuid,%L,%L::uuid)',first_run,'invalid',test_job),'23514');
  perform pg_temp.photo_assert(public.photo_worker_claim(first_run,'plate',test_job) is null,'absent job not claimed');

  -- Synthetic journal only: this UUID has no real queue row or Storage object.
  insert into private.photo_worker_journal(kind,job_id,run_id,asset_id,bucket,object_path)
    values('plate',test_job,first_run,test_asset,'plate-media',test_asset::text||'.webp');
  perform pg_temp.photo_assert(public.photo_worker_close(first_run)=false,'unfinished run stays owned');
  perform public.photo_worker_block(first_run,'plate',test_job,'upload_uncertain');
  perform pg_temp.photo_expect(format('select public.photo_worker_open(%L::uuid,%L::uuid,true,false)',next_run,first_run),'23514');
  perform public.photo_worker_open(next_run,first_run,true,true);
  perform pg_temp.photo_expect(format('select public.photo_worker_poll(%L::uuid)',first_run),'40001');
  perform pg_temp.photo_assert((select run_id=next_run and asset_id=test_asset and phase='claimed'
    and failure_code is null from private.photo_worker_journal where kind='plate' and job_id=test_job),'recovery preserves output identity');
  perform pg_temp.photo_assert(public.photo_worker_close(next_run)=false,'recovery does not pretend to finish a job');
end $$;

select 'PASS photo worker ownership (metadata only; rolled back)' as result;
rollback;
