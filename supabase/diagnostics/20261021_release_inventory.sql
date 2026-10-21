-- Local release inventory only. Run through the explicitly named local Docker
-- container after owner approval. No user rows, credentials, object paths or
-- function bodies are selected. This is not a schema installation or test.
begin read only;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

do $$
begin
  if current_database() <> 'postgres'
    or to_regclass('public.profiles') is null
    or to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'Expected installed local app schema and migration history';
  end if;
end;
$$;

select 'local_release_inventory' as checkpoint,
  current_setting('server_version') as postgres_version,
  current_setting('transaction_read_only') as read_only;

select version as recorded_migration
from supabase_migrations.schema_migrations
order by version;

select feature, to_regclass(relation_name) is not null as installed_relation_present
from (values
  ('photo worker', 'private.photo_worker_control'),
  ('photo worker journal', 'private.photo_worker_journal'),
  ('follow notifications', 'private.follow_notifications'),
  ('Menu gallery', 'private.menu_saved_photos'),
  ('Plate likes', 'private.plate_likes'),
  ('Plate comments', 'private.plate_comments'),
  ('introduction', 'private.introduction_preferences'),
  ('Table activity', 'private.table_activity_events'),
  ('follow acceptance', 'private.follow_acceptance_notifications')
) as expected(feature, relation_name)
order by feature;

-- Metadata only: existence/signature checks do not invoke app functions.
select n.nspname as schema_name,
  p.proname as readiness_function,
  pg_get_function_identity_arguments(p.oid) as argument_types,
  md5(pg_get_functiondef(p.oid)) as definition_fingerprint
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.proname like '%\_ready' escape '\'
order by p.proname, argument_types;

-- Catalog totals are structural counts, not counts of accounts or content.
select n.nspname as schema_name,
  count(*) filter (where c.relkind = 'r') as ordinary_tables,
  count(*) filter (where c.relkind = 'r' and c.relrowsecurity) as rls_tables,
  count(*) filter (where c.relkind = 'v') as views
from pg_namespace n
join pg_class c on c.relnamespace = n.oid
where n.nspname in ('public', 'private')
group by n.nspname
order by n.nspname;

rollback;
