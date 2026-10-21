\set ON_ERROR_STOP on
-- Local search acceptance suite. Every synthetic record rolls back.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create temporary table search_actors(name text primary key, auth_id uuid not null default gen_random_uuid(), profile_id uuid) on commit drop;
insert into search_actors(name) values ('owner'), ('member'), ('outsider');
create temporary table search_ids(name text primary key, id uuid not null) on commit drop;
create function pg_temp.search_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.search_ids where name = p_name;
$$;
create function pg_temp.assert_true(p_value boolean, p_message text) returns void language plpgsql as $$
begin if p_value is distinct from true then raise exception 'FAIL: %', p_message; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_code text, p_message text) returns void language plpgsql as $$
declare actual_code text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate;
    if actual_code = p_code then return; end if;
    raise exception 'FAIL: %, expected %, got %: %', p_message, p_code, actual_code, sqlerrm;
  end;
  raise exception 'FAIL: % unexpectedly succeeded', p_message;
end $$;
do $$ begin execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text); end $$;
grant select on search_actors to authenticated, anon;
grant select, insert on search_ids to authenticated;
grant select on search_ids to anon;
grant execute on function pg_temp.search_id(text), pg_temp.assert_true(boolean,text),
  pg_temp.expect_error(text,text,text) to authenticated, anon;

select pg_temp.assert_true(current_user='postgres','local postgres test role');
select pg_temp.assert_true((select bool_and(not p.prosecdef and 'search_path=""'=any(p.proconfig))
  from pg_proc p where p.oid in ('public.search_plates(text)'::regprocedure,
    'public.search_table(uuid,text)'::regprocedure, 'public.search_menu(text)'::regprocedure)),
  'search functions run as caller with fixed path');
insert into auth.users(id,raw_user_meta_data)
  select auth_id,jsonb_build_object('display_name',
    case name when 'owner' then 'Search River' else 'Search ' || name end) from search_actors;
update search_actors a set profile_id=l.profile_id from private.profile_auth_links l where l.auth_user_id=a.auth_id;
insert into search_ids select 'category_' || slug,id from public.categories;

select set_config('request.jwt.claim.sub',(select auth_id::text from search_actors where name='owner'),true);
set local role authenticated;
insert into search_ids values ('table',public.create_group('Search Supper Table'));
insert into search_ids values ('other_table',public.create_group('Search Hidden Table'));
insert into search_ids values ('plate',public.publish_plate(pg_temp.search_id('category_meal'),
  'Original sea bass supper','["https://example.test/blue-cafe"]','["Citrus"]'));
insert into search_ids values ('percent_plate',public.publish_plate(pg_temp.search_id('category_recipe'),
  'A 100% simple soup'));
insert into search_ids values ('share',public.share_plate(pg_temp.search_id('table'),
  pg_temp.search_id('plate'),gen_random_uuid(),'Supper suggestion'));
insert into search_ids values ('request',public.post_table_request(pg_temp.search_id('table'),
  gen_random_uuid(),'Where is the quiet café?','Near the market'));
insert into search_ids values ('private_request',public.post_table_request(pg_temp.search_id('other_table'),
  gen_random_uuid(),'Hidden truffle question'));
insert into search_ids select 'thread',id from public.threads where root_entry_id=pg_temp.search_id('request');
insert into search_ids values ('reply',public.reply_to_thread(pg_temp.search_id('thread'),
  gen_random_uuid(),'The garden café has a quiet corner'));
insert into search_ids values ('plate_save',public.save_plate(pg_temp.search_id('plate'),1));
insert into search_ids values ('request_save',public.save_table_request(pg_temp.search_id('request')));
select pg_temp.assert_true((select count(*)=1 from public.search_plates('citrus')
  where id=pg_temp.search_id('plate')),'Plate tag search');
select pg_temp.assert_true((select count(*)=2 from public.search_plates('Search River')),
  'author-name search finds both Plates');
select pg_temp.assert_true((select count(*)=1 from public.search_plates('%')
  where id=pg_temp.search_id('percent_plate')),'percent is a literal term, not a wildcard');
select pg_temp.assert_true((select count(*)=1 from public.search_plates('blue-cafe')
  where id=pg_temp.search_id('plate')),'Plate link search');
select pg_temp.assert_true((select count(*)=1 from public.search_table(pg_temp.search_id('table'),'quiet café')
  where kind='request' and entry_id=pg_temp.search_id('request')),'Request question search');
select pg_temp.assert_true((select count(*)=1 from public.search_table(pg_temp.search_id('table'),'garden café')
  where kind='reply' and entry_id=pg_temp.search_id('request') and reply_id=pg_temp.search_id('reply')),
  'reply links to its root');
select pg_temp.assert_true((select count(*)=1 from public.search_table(pg_temp.search_id('table'),'citrus')
  where kind='plate_share' and entry_id=pg_temp.search_id('share')),'shared Plate tag search');
select pg_temp.assert_true((select count(*)=0 from public.search_table(pg_temp.search_id('table'),'truffle')),
  'chosen Table does not mix another Table');
select pg_temp.assert_true((select count(*)=1 from public.search_menu('sea bass')
  where save_type='plate' and save_id=pg_temp.search_id('plate_save')),'saved Plate text search');
select pg_temp.assert_true((select count(*)=1 from public.search_menu('quiet café')
  where save_type='request' and save_id=pg_temp.search_id('request_save')),'saved live Request search');
select public.edit_plate(pg_temp.search_id('plate'),1,pg_temp.search_id('category_meal'),'Updated dinner');
select pg_temp.assert_true((select count(*)=0 from public.search_plates('sea bass')),
  'Plate search uses live text');
select pg_temp.assert_true((select count(*)=1 from public.search_menu('sea bass')
  where save_id=pg_temp.search_id('plate_save')),'Menu search keeps first saved wording');
select pg_temp.expect_error('select * from public.search_plates(''  '')','23514','blank search rejected');
reset role;

select id from public.profiles where id in (select profile_id from search_actors) order by id for share;
select id from public.groups where id=pg_temp.search_id('table') for update;
insert into public.group_memberships(group_id,user_id,role,state)
  select pg_temp.search_id('table'),profile_id,'member','active' from search_actors where name='member';
insert into public.membership_periods(group_id,user_id,joined_at)
  select pg_temp.search_id('table'),profile_id,'2026-01-01T00:00:00Z' from search_actors where name='member';
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claim.sub',(select auth_id::text from search_actors where name='member'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.search_table(pg_temp.search_id('table'),'garden café')
  where kind='reply'),'new member searches earlier replies');
select pg_temp.assert_true((select count(*)=0 from public.search_table(pg_temp.search_id('table'),'truffle')),
  'member search excludes another Table');
select pg_temp.expect_error(format('select * from public.search_table(%L::uuid,%L)',
  pg_temp.search_id('other_table'),'truffle'),'42501','member cannot search unjoined Table');
select pg_temp.assert_true((select count(*)=0 from public.search_menu('sea bass')),
  'member cannot search another person’s Menu');
reset role;

select set_config('request.jwt.claim.sub',(select auth_id::text from search_actors where name='outsider'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.search_plates('sea bass')
  where id=pg_temp.search_id('plate')) is false,'outsider sees current Plate, not old text');
select pg_temp.assert_true((select count(*)=1 from public.search_plates('Updated dinner')
  where id=pg_temp.search_id('plate')),'signed-in outsider can search available Plate');
select pg_temp.expect_error(format('select * from public.search_table(%L::uuid,%L)',
  pg_temp.search_id('table'),'garden café'),'42501','outsider cannot search Table');
select pg_temp.assert_true((select count(*)=0 from public.search_menu('sea bass')),
  'outsider cannot search another person’s Menu');
reset role;
set local role anon;
select pg_temp.expect_error('select * from public.search_plates(''supper'')','42501','anonymous Plate search denied');
select pg_temp.expect_error(format('select * from public.search_table(%L::uuid,%L)',
  pg_temp.search_id('table'),'supper'),'42501','anonymous Table search denied');
select pg_temp.expect_error('select * from public.search_menu(''supper'')','42501','anonymous Menu search denied');
reset role;
set constraints all immediate;
select 'PASS: Search SQL acceptance checks completed; all fixtures rolled back' as result;
rollback;
