-- Read-only activation checkpoint. No notification data or identities emitted.
begin read only;
set local statement_timeout='5s';
select
  to_regclass('private.table_activity_events') is null as activity_table_absent,
  to_regclass('private.follow_acceptance_notifications') is null as acceptance_table_absent,
  to_regprocedure('public.table_activity_ready()') is null as readiness_absent,
  not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_clear_table_notifications') as new_trigger_absent,
  to_regprocedure('public.my_follow_notifications()') is not null as existing_follow_api_present,
  to_regclass('private.mention_notifications') is not null as existing_mentions_present,
  to_regclass('public.membership_periods') is not null as membership_periods_present;
rollback;
