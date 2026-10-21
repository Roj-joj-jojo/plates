-- Run after candidate migration inside a surrounding transaction; no fixtures needed.
set local statement_timeout = '20s';
create function pg_temp.grants_assert(p_ok boolean, p_why text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text);
end $$;
grant execute on function pg_temp.grants_assert(boolean,text) to authenticated, anon;

select pg_temp.grants_assert(not has_column_privilege('anon', 'public.media_assets', 'id', 'SELECT'),
  'anonymous role has no direct media table read grant');
select pg_temp.grants_assert((select bool_and(
  not has_table_privilege('anon', table_name, 'SELECT')
  and not has_table_privilege('anon', table_name, 'INSERT')
  and not has_table_privilege('anon', table_name, 'UPDATE')
  and not has_table_privilege('anon', table_name, 'DELETE'))
  from (values ('public.media_upload_intents'), ('public.media_assets'), ('public.plate_media'),
    ('public.table_upload_intents'), ('public.table_media_assets'), ('public.entry_media'),
    ('public.reply_media'), ('public.menu_preview_jobs'),
    ('public.menu_preview_assets')) as media_tables(table_name)),
  'anonymous role has no direct grants on any media metadata table');
select pg_temp.grants_assert(not has_column_privilege('authenticated', 'public.media_assets',
  'object_path', 'SELECT'), 'signed-in role cannot read worker-only Plate object paths');
select pg_temp.grants_assert(not has_column_privilege('authenticated', 'public.table_media_assets',
  'object_path', 'SELECT'), 'signed-in role cannot read worker-only Table object paths');
select pg_temp.grants_assert(not has_column_privilege('authenticated', 'public.menu_preview_assets',
  'object_path', 'SELECT'), 'signed-in role cannot read worker-only Menu preview paths');
select pg_temp.grants_assert(not has_column_privilege('authenticated', 'public.media_upload_intents',
  'staged_path', 'SELECT'), 'signed-in role cannot read staged object paths directly');
select pg_temp.grants_assert(has_column_privilege('authenticated', 'public.media_assets',
  'id', 'SELECT'), 'signed-in role retains permitted media ID reads');
select pg_temp.grants_assert(has_table_privilege('service_role', 'public.media_assets', 'UPDATE')
  and has_table_privilege('service_role', 'public.menu_preview_jobs', 'UPDATE'),
  'local media worker retains its required updates');
select pg_temp.grants_assert(not has_function_privilege('authenticated',
  'private.validate_plate_images(uuid[],uuid,uuid)', 'EXECUTE'),
  'signed-in role cannot call the internal image validator');

set local role authenticated;
select id from public.media_assets limit 0;
do $$ begin
  begin
    perform object_path from public.media_assets limit 1;
    raise exception 'FAIL: hidden object_path was readable';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform id from public.media_assets limit 1;
    raise exception 'FAIL: anonymous media table read succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS media grants' as result;
