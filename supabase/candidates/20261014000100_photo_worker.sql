-- Candidate only. NOT applied. No Storage/Auth deletion or hosted execution.
-- Stop the legacy media worker before activation; do not run both implementations.
begin;

create table private.photo_worker_control (
  singleton boolean primary key default true check(singleton),
  active_run uuid,
  updated_at timestamptz not null default clock_timestamp()
);
insert into private.photo_worker_control(singleton) values(true);
create table private.photo_worker_runs (
  id uuid primary key,
  state text not null check(state in ('active','drained','operator_stopped')),
  created_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz
);
create table private.photo_worker_journal (
  kind text not null check(kind in ('plate','table','preview')),
  job_id uuid not null,
  run_id uuid not null references private.photo_worker_runs(id) on delete restrict,
  asset_id uuid not null unique default gen_random_uuid(),
  phase text not null default 'claimed' check(phase in ('claimed','prepared','blocked','complete','rejected')),
  bucket text not null,
  object_path text not null,
  sha256 text check(sha256 ~ '^[0-9a-f]{64}$'),
  byte_count integer check(byte_count between 1 and 10000000),
  width integer check(width between 1 and 2048),
  height integer check(height between 1 and 2048),
  failure_code text check(failure_code in ('prepare','upload_uncertain','verify','complete_uncertain','decode','source')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(kind,job_id),
  unique(bucket,object_path),
  check((sha256 is null) = (byte_count is null)),
  check((sha256 is null) = (width is null)),
  check((sha256 is null) = (height is null))
);
alter table private.photo_worker_control enable row level security;
alter table private.photo_worker_runs enable row level security;
alter table private.photo_worker_journal enable row level security;
revoke all on private.photo_worker_control,private.photo_worker_runs,private.photo_worker_journal
  from public,anon,authenticated,service_role;

create function private.photo_job_table(p_kind text) returns text
language sql immutable set search_path='' as $$
  select case p_kind when 'plate' then 'media_upload_intents'
    when 'table' then 'table_upload_intents' when 'preview' then 'menu_preview_jobs' end;
$$;
create function private.lock_photo_worker(p_run uuid) returns void
language plpgsql security definer set search_path='' as $$
declare active uuid;
begin
  if auth.role() is distinct from 'service_role' or p_run is null then
    raise exception 'Photo worker required' using errcode='42501'; end if;
  select active_run into active from private.photo_worker_control where singleton for update;
  if active is distinct from p_run then
    raise exception 'Worker ownership changed' using errcode='40001'; end if;
end $$;
create function public.photo_worker_ready() returns integer
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Photo worker required' using errcode='42501'; end if;
  return 1;
end $$;

create function public.photo_worker_open(p_run_id uuid,p_previous_run_id uuid default null,
  p_writer_stopped boolean default false,p_requests_drained boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare old_run uuid;
begin
  if auth.role() is distinct from 'service_role' or p_run_id is null then
    raise exception 'Photo worker required' using errcode='42501'; end if;
  select active_run into old_run from private.photo_worker_control where singleton for update;
  if old_run=p_run_id then return; end if;
  if exists(select 1 from private.photo_worker_runs where id=p_run_id) then
    raise exception 'Use a fresh run identifier' using errcode='23514'; end if;
  if old_run is not null then
    if p_previous_run_id is distinct from old_run or p_writer_stopped is distinct from true
      or p_requests_drained is distinct from true then
      raise exception 'Previous writer shutdown and request drain must be confirmed' using errcode='23514'; end if;
    update private.photo_worker_runs set state='operator_stopped',ended_at=clock_timestamp() where id=old_run;
  elsif p_previous_run_id is not null then
    raise exception 'Unexpected recovery target' using errcode='23514';
  end if;
  -- Old unjournalled processing jobs cannot be adopted by guessing their output.
  if exists(select 1 from public.media_upload_intents i where i.state='processing'
      and not exists(select 1 from private.photo_worker_journal j where j.kind='plate' and j.job_id=i.id))
    or exists(select 1 from public.table_upload_intents i where i.state='processing'
      and not exists(select 1 from private.photo_worker_journal j where j.kind='table' and j.job_id=i.id))
    or exists(select 1 from public.menu_preview_jobs i where i.state='processing'
      and not exists(select 1 from private.photo_worker_journal j where j.kind='preview' and j.job_id=i.id)) then
    raise exception 'Legacy processing jobs require separately scoped recovery' using errcode='23514'; end if;
  insert into private.photo_worker_runs(id,state) values(p_run_id,'active');
  update private.photo_worker_journal set run_id=p_run_id,
    phase=case when sha256 is null then 'claimed' else 'prepared' end,
    failure_code=null,updated_at=clock_timestamp() where phase not in ('complete','rejected');
  update private.photo_worker_control set active_run=p_run_id,updated_at=clock_timestamp() where singleton;
end $$;

create function public.photo_worker_poll(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare jobs jsonb; counts jsonb; blocked integer;
begin
  perform private.lock_photo_worker(p_run_id);
  with queue as (
    select 'plate'::text kind,id,created_at,to_jsonb(i) data from public.media_upload_intents i where state='pending'
    union all select 'table',id,created_at,to_jsonb(i) from public.table_upload_intents i where state='pending'
    union all select 'preview',id,created_at,to_jsonb(i) from public.menu_preview_jobs i where state='pending'
    union all select j.kind,j.job_id,j.created_at,to_jsonb(i) from private.photo_worker_journal j
      join public.media_upload_intents i on i.id=j.job_id and j.kind='plate'
      where j.phase in ('claimed','prepared') and i.state='processing'
    union all select j.kind,j.job_id,j.created_at,to_jsonb(i) from private.photo_worker_journal j
      join public.table_upload_intents i on i.id=j.job_id and j.kind='table'
      where j.phase in ('claimed','prepared') and i.state='processing'
    union all select j.kind,j.job_id,j.created_at,to_jsonb(i) from private.photo_worker_journal j
      join public.menu_preview_jobs i on i.id=j.job_id and j.kind='preview'
      where j.phase in ('claimed','prepared') and i.state='processing'
  ), chosen as (select * from queue order by created_at,kind,id limit 10)
  select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'data',data)
    order by created_at,kind,id),'[]'::jsonb) into jobs from chosen;
  select count(*) into blocked from private.photo_worker_journal where phase='blocked';
  select jsonb_build_object('plate_pending',(select count(*) from public.media_upload_intents where state='pending'),
    'table_pending',(select count(*) from public.table_upload_intents where state='pending'),
    'preview_pending',(select count(*) from public.menu_preview_jobs where state='pending'),
    'blocked',blocked) into counts;
  return jsonb_build_object('jobs',jobs,'counts',counts);
end $$;

create function public.photo_worker_claim(p_run_id uuid,p_kind text,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare table_name text:=private.photo_job_table(p_kind); job jsonb; owner_id uuid;
  entry private.photo_worker_journal%rowtype; new_asset uuid:=gen_random_uuid(); bucket_name text; path text;
begin
  perform private.lock_photo_worker(p_run_id);
  if table_name is null or p_job_id is null then raise exception 'Invalid photo job' using errcode='23514'; end if;
  -- Lock profile before job rows, matching the existing erasure/media guards.
  execute format('select to_jsonb(i) from public.%I i where id=$1',table_name) into job using p_job_id;
  if job is null then return null; end if;
  owner_id:=coalesce((job->>'uploader_id')::uuid,(job->>'saver_id')::uuid);
  perform 1 from public.profiles where id=owner_id and state='active' for share;
  if not found then raise exception 'Photo owner unavailable' using errcode='42501'; end if;
  execute format('select to_jsonb(i) from public.%I i where id=$1 for update',table_name) into job using p_job_id;
  select * into entry from private.photo_worker_journal where kind=p_kind and job_id=p_job_id for update;
  if found then
    if entry.run_id<>p_run_id or entry.phase='blocked' then raise exception 'Job blocked' using errcode='23514'; end if;
    return to_jsonb(entry);
  end if;
  if job->>'state'<>'pending' then return null; end if;
  bucket_name:=case p_kind when 'table' then 'table-media' when 'preview' then 'menu-previews' else 'plate-media' end;
  path:=case p_kind when 'table' then (job->>'group_id')||'/'
    when 'preview' then owner_id::text||'/' else '' end||new_asset::text||'.webp';
  insert into private.photo_worker_journal(kind,job_id,run_id,asset_id,bucket,object_path)
    values(p_kind,p_job_id,p_run_id,new_asset,bucket_name,path) returning * into entry;
  perform set_config('private.photo_worker_claim','allowed',true);
  execute format('update public.%I set state=''processing'',updated_at=clock_timestamp() where id=$1',table_name) using p_job_id;
  return to_jsonb(entry);
end $$;

create function public.photo_worker_prepare(p_run_id uuid,p_kind text,p_job_id uuid,
  p_sha256 text,p_byte_count integer,p_width integer,p_height integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry private.photo_worker_journal%rowtype; job jsonb; owner_id uuid;
  source_author uuid; table_name text:=private.photo_job_table(p_kind);
begin
  perform private.lock_photo_worker(p_run_id);
  if table_name is null then raise exception 'Invalid photo job' using errcode='23514'; end if;
  execute format('select to_jsonb(i) from public.%I i where id=$1',table_name) into job using p_job_id;
  owner_id:=coalesce((job->>'uploader_id')::uuid,(job->>'saver_id')::uuid);
  if p_kind='preview' then select author_id into source_author from public.plates where id=(job->>'plate_id')::uuid; end if;
  perform 1 from public.profiles where id in (owner_id,source_author) order by id for share;
  select * into entry from private.photo_worker_journal where kind=p_kind and job_id=p_job_id for update;
  if not found or entry.run_id<>p_run_id or entry.phase not in ('claimed','prepared')
    or job->>'state' is distinct from 'processing' then raise exception 'Job unavailable' using errcode='23514'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_count is null or p_byte_count<1
    or p_byte_count>(case when p_kind='preview' then 3000000 else 10000000 end)
    or p_width is null or p_height is null or least(p_width,p_height)<1
    or greatest(p_width,p_height)>(case when p_kind='preview' then 640 else 2048 end) then
    raise exception 'Invalid prepared photo' using errcode='23514'; end if;
  if entry.sha256 is not null and row(entry.sha256,entry.byte_count,entry.width,entry.height)
    is distinct from row(p_sha256,p_byte_count,p_width,p_height) then
    raise exception 'Prepared bytes changed; do not overwrite' using errcode='23514'; end if;
  perform public.register_media_object_attempt(entry.bucket,entry.object_path,owner_id,
    case when p_kind='preview' then (job->>'plate_id')::uuid else null end);
  update private.photo_worker_journal set phase='prepared',sha256=p_sha256,byte_count=p_byte_count,
    width=p_width,height=p_height,updated_at=clock_timestamp() where kind=p_kind and job_id=p_job_id returning * into entry;
  return to_jsonb(entry);
end $$;

create function public.photo_worker_complete(p_run_id uuid,p_kind text,p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare entry private.photo_worker_journal%rowtype; job jsonb; owner_id uuid; source_author uuid;
  table_name text:=private.photo_job_table(p_kind);
begin
  perform private.lock_photo_worker(p_run_id);
  if table_name is null then raise exception 'Invalid photo job' using errcode='23514'; end if;
  execute format('select to_jsonb(i) from public.%I i where id=$1',table_name) into job using p_job_id;
  owner_id:=coalesce((job->>'uploader_id')::uuid,(job->>'saver_id')::uuid);
  if p_kind='preview' then select author_id into source_author from public.plates where id=(job->>'plate_id')::uuid; end if;
  perform 1 from public.profiles where id in (owner_id,source_author) order by id for share;
  select * into entry from private.photo_worker_journal where kind=p_kind and job_id=p_job_id for update;
  if not found or entry.run_id<>p_run_id then raise exception 'Job unavailable' using errcode='23514'; end if;
  if entry.phase='complete' then return; end if;
  if entry.phase<>'prepared' then raise exception 'Photo not prepared' using errcode='23514'; end if;
  -- The trusted worker verifies Storage bytes against the acknowledged hash first.
  case p_kind
    when 'plate' then perform public.finish_plate_upload(p_job_id,entry.asset_id,entry.object_path,entry.width,entry.height);
    when 'table' then perform public.finish_table_upload(p_job_id,entry.asset_id,entry.object_path,entry.width,entry.height);
    when 'preview' then perform public.finish_menu_preview(p_job_id,entry.asset_id,entry.object_path,entry.width,entry.height);
    else raise exception 'Invalid photo kind' using errcode='23514';
  end case;
  perform public.finish_media_object_attempt(entry.bucket,entry.object_path);
  update private.photo_worker_journal set phase='complete',failure_code=null,updated_at=clock_timestamp()
    where kind=p_kind and job_id=p_job_id;
end $$;

create function public.photo_worker_reject(p_run_id uuid,p_kind text,p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare entry private.photo_worker_journal%rowtype; job jsonb;
  table_name text:=private.photo_job_table(p_kind); owner_id uuid;
begin
  perform private.lock_photo_worker(p_run_id);
  if table_name is null then raise exception 'Invalid photo job' using errcode='23514'; end if;
  execute format('select to_jsonb(i) from public.%I i where id=$1',table_name) into job using p_job_id;
  owner_id:=coalesce((job->>'uploader_id')::uuid,(job->>'saver_id')::uuid);
  perform 1 from public.profiles where id=owner_id for share;
  execute format('select to_jsonb(i) from public.%I i where id=$1 for update',table_name) into job using p_job_id;
  select * into entry from private.photo_worker_journal where kind=p_kind and job_id=p_job_id for update;
  if not found or entry.run_id<>p_run_id then raise exception 'Job unavailable' using errcode='23514'; end if;
  if entry.phase='rejected' then return; end if;
  if entry.phase<>'claimed' or entry.sha256 is not null or job->>'state' is distinct from 'processing'
    or exists(select 1 from private.media_object_attempts where bucket_id=entry.bucket and object_path=entry.object_path) then
    raise exception 'Prepared or uncertain output must remain protected' using errcode='23514'; end if;
  case p_kind
    when 'plate' then perform public.fail_plate_upload(p_job_id,'Photo could not be processed. Please try another image.');
    when 'table' then perform public.fail_table_upload(p_job_id,'Photo could not be processed. Please try another image.');
    when 'preview' then perform public.fail_menu_preview(p_job_id,'Menu preview could not be processed. Please try another image.');
  end case;
  update private.photo_worker_journal set phase='rejected',failure_code='decode',updated_at=clock_timestamp()
    where kind=p_kind and job_id=p_job_id;
end $$;

create function public.photo_worker_block(p_run_id uuid,p_kind text,p_job_id uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_photo_worker(p_run_id);
  update private.photo_worker_journal set phase='blocked',failure_code=p_code,updated_at=clock_timestamp()
    where kind=p_kind and job_id=p_job_id and run_id=p_run_id and phase not in ('complete','rejected');
  -- No removal or attempt-completion acknowledgement: uncertain writes stay fenced.
end $$;
create function public.photo_worker_close(p_run_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform private.lock_photo_worker(p_run_id);
  if exists(select 1 from private.photo_worker_journal where run_id=p_run_id and phase not in ('complete','rejected')) then return false; end if;
  update private.photo_worker_runs set state='drained',ended_at=clock_timestamp() where id=p_run_id;
  update private.photo_worker_control set active_run=null,updated_at=clock_timestamp() where singleton;
  return true;
end $$;

-- Prevent a legacy worker from claiming unjournalled work after activation.
create function private.require_photo_worker_claim() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.state='pending' and new.state='processing'
    and current_setting('private.photo_worker_claim',true) is distinct from 'allowed' then
    raise exception 'Use the acknowledged photo worker' using errcode='42501'; end if;
  return new;
end $$;
create trigger plate_photo_worker_claim before update of state on public.media_upload_intents
  for each row execute function private.require_photo_worker_claim();
create trigger table_photo_worker_claim before update of state on public.table_upload_intents
  for each row execute function private.require_photo_worker_claim();
create trigger preview_photo_worker_claim before update of state on public.menu_preview_jobs
  for each row execute function private.require_photo_worker_claim();

revoke all on function private.photo_job_table(text),private.lock_photo_worker(uuid),private.require_photo_worker_claim()
  from public,anon,authenticated,service_role;
revoke all on function public.photo_worker_ready(),public.photo_worker_open(uuid,uuid,boolean,boolean),
  public.photo_worker_poll(uuid),public.photo_worker_claim(uuid,text,uuid),
  public.photo_worker_prepare(uuid,text,uuid,text,integer,integer,integer),public.photo_worker_complete(uuid,text,uuid),
  public.photo_worker_reject(uuid,text,uuid),public.photo_worker_block(uuid,text,uuid,text),public.photo_worker_close(uuid) from public,anon,authenticated,service_role;
grant execute on function public.photo_worker_ready(),public.photo_worker_open(uuid,uuid,boolean,boolean),
  public.photo_worker_poll(uuid),public.photo_worker_claim(uuid,text,uuid),
  public.photo_worker_prepare(uuid,text,uuid,text,integer,integer,integer),public.photo_worker_complete(uuid,text,uuid),
  public.photo_worker_reject(uuid,text,uuid),public.photo_worker_block(uuid,text,uuid,text),public.photo_worker_close(uuid) to service_role;
commit;
