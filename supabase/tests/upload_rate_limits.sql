-- Run in a surrounding transaction with M4a upload-rate migration, then roll back.
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create temporary table rate_test_actor(label text primary key, auth_id uuid, profile_id uuid) on commit drop;
insert into rate_test_actor(label,auth_id) values
  ('hour',gen_random_uuid()), ('day',gen_random_uuid()), ('other',gen_random_uuid());
insert into auth.users(id,raw_user_meta_data)
  select auth_id,jsonb_build_object('display_name','Rate test ' || label) from rate_test_actor;
update rate_test_actor a set profile_id = l.profile_id
  from private.profile_auth_links l where l.auth_user_id = a.auth_id;

create function pg_temp.expect_upload_limit(p_message text)
returns void language plpgsql as $$
declare actual text;
begin
  begin
    perform public.request_plate_upload();
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = 'P0001' and sqlerrm = p_message then return; end if;
    raise exception 'Wrong upload limit: code %, message %', actual, sqlerrm;
  end;
  raise exception 'Expected upload limit, but an intent was issued';
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated', pg_my_temp_schema()::regnamespace::text);
end $$;
grant execute on function pg_temp.expect_upload_limit(text) to authenticated;

select set_config('request.jwt.claim.sub',(select auth_id::text from rate_test_actor where label = 'hour'),true);
set local role authenticated;
do $$ begin
  for n in 1..6 loop perform public.request_plate_upload(); end loop;
end $$;
select pg_temp.expect_upload_limit('Wait for your current photos to finish processing');
reset role;
update public.media_upload_intents set state = 'failed', error_message = 'Synthetic failure'
  where uploader_id = (select profile_id from rate_test_actor where label = 'hour');
set local role authenticated;
do $$ begin
  for n in 1..6 loop perform public.request_plate_upload(); end loop;
end $$;
select pg_temp.expect_upload_limit('Hourly photo limit reached. Try again later');
reset role;

insert into public.media_upload_intents(uploader_id, staged_path, state, error_message, created_at)
  select a.profile_id, a.profile_id::text || '/' || gen_random_uuid()::text,
    'failed', 'Synthetic historical attempt', clock_timestamp() - interval '2 hours'
  from rate_test_actor a cross join generate_series(1,60) where a.label = 'day';
select set_config('request.jwt.claim.sub',(select auth_id::text from rate_test_actor where label = 'day'),true);
set local role authenticated;
select pg_temp.expect_upload_limit('Daily photo limit reached. Try again tomorrow');
reset role;

select set_config('request.jwt.claim.sub',(select auth_id::text from rate_test_actor where label = 'other'),true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.request_plate_upload()) <> 1 then
    raise exception 'Another account was incorrectly rate limited';
  end if;
end $$;
reset role;
select 'PASS: per-account pending, hourly and daily upload limits' as result;
