-- Owner-run SELECT only in the intended hosted alpha project's SQL Editor.
-- Reports counts/metadata only; no credentials or account/content rows.
-- This is not an installation command and does not check dashboard Auth settings.
select
  current_user as execution_role,
  current_setting('server_version') as postgres_version,
  not exists(select 1 from auth.users) as no_auth_users,
  not exists(select 1 from pg_namespace where nspname='private') as no_private_schema,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','S')) as public_relations,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public') as public_routines,
  not exists(select 1 from storage.buckets) as no_storage_buckets,
  (select count(*)=4 from pg_roles
    where rolname in ('anon','authenticated','service_role','supabase_storage_admin')) as required_roles_present,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_table_present;
