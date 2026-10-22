-- Owner-run SELECT only in hosted alpha SQL Editor after the 33-file push.
-- Structural checks, not complete policy/ACL or hosted behavioural acceptance.
select
  (select count(*) from supabase_migrations.schema_migrations) as migrations,
  (select max(version) from supabase_migrations.schema_migrations) as latest_migration,
  (select count(*) from pg_tables where schemaname='public') as public_tables,
  (select count(*) from pg_tables where schemaname='public' and not rowsecurity) as tables_without_rls,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from storage.buckets b where b.public) as public_buckets,
  not exists(select 1 from auth.users) as no_auth_users;
