-- Run after M4b inside an outer transaction, then roll back every fixture.
set local statement_timeout = '20s';
set local lock_timeout = '3s';
create temporary table preview_test_ids(name text primary key, id uuid) on commit drop;
create function pg_temp.preview_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.preview_test_ids where name = p_name;
$$;
create function pg_temp.preview_assert(p_ok boolean, p_why text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if; end $$;
create function pg_temp.preview_expect(p_sql text, p_code text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute p_sql;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = p_code then return; end if;
    raise exception 'Expected %, got %: %', p_code, actual, sqlerrm;
  end;
  raise exception 'Expected % but operation succeeded', p_code;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon, service_role', pg_my_temp_schema()::regnamespace::text);
end $$;
grant select, insert on preview_test_ids to authenticated, service_role;
grant execute on function pg_temp.preview_id(text), pg_temp.preview_assert(boolean,text),
  pg_temp.preview_expect(text,text) to authenticated, anon, service_role;

insert into auth.users(id, raw_user_meta_data)
  values (gen_random_uuid(), '{"display_name":"Menu preview test owner"}'::jsonb),
         (gen_random_uuid(), '{"display_name":"Menu preview test outsider"}'::jsonb);
insert into preview_test_ids
  select case raw_user_meta_data->>'display_name'
    when 'Menu preview test owner' then 'owner' else 'outsider' end, id
  from auth.users where raw_user_meta_data->>'display_name'
    in ('Menu preview test owner', 'Menu preview test outsider');
insert into preview_test_ids select 'meal', id from public.categories where slug = 'meal';
insert into preview_test_ids select 'owner_profile', profile_id
  from private.profile_auth_links where auth_user_id = pg_temp.preview_id('owner');

select set_config('request.jwt.claim.sub', pg_temp.preview_id('owner')::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
insert into preview_test_ids select 'intent', intent_id from public.request_plate_upload();
select pg_temp.preview_expect(format('select public.finish_menu_preview(%L::uuid,%L::uuid,%L,200,200)',
  gen_random_uuid(), gen_random_uuid(), 'invalid.webp'), '42501');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.media_upload_intents set state = 'processing'
  where id = pg_temp.preview_id('intent');
insert into preview_test_ids values ('image', gen_random_uuid());
select public.finish_plate_upload(pg_temp.preview_id('intent'), pg_temp.preview_id('image'),
  pg_temp.preview_id('image')::text || '.webp', 800, 600);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into preview_test_ids values ('plate', public.publish_plate(pg_temp.preview_id('meal'),
  '', '[]', '[]', array[pg_temp.preview_id('image')]));
select pg_temp.preview_expect(format('select public.save_plate(%L::uuid,1,null,null)',
  pg_temp.preview_id('plate')), '23514');
insert into preview_test_ids values ('job', public.request_menu_preview(pg_temp.preview_id('plate'), 1));
select pg_temp.preview_assert(public.request_menu_preview(pg_temp.preview_id('plate'), 1)
  = pg_temp.preview_id('job'), 'same revision reuses pending job');
select pg_temp.preview_assert(not private.can_read_menu_preview_object('menu-previews','unissued.webp'),
  'unissued preview path denied');
select pg_temp.preview_expect($q$insert into public.menu_preview_assets(id) values (gen_random_uuid())$q$,
  '42501');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.menu_preview_jobs set state = 'processing' where id = pg_temp.preview_id('job');
insert into preview_test_ids values ('preview', gen_random_uuid());
select public.finish_menu_preview(pg_temp.preview_id('job'), pg_temp.preview_id('preview'),
  (select saver_id::text from public.menu_preview_jobs where id = pg_temp.preview_id('job'))
    || '/' || pg_temp.preview_id('preview')::text || '.webp', 640, 480);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.preview_assert(not private.can_read_menu_preview_object('menu-previews',
  pg_temp.preview_id('owner_profile')::text || '/' || pg_temp.preview_id('preview')::text || '.webp'),
  'preview is not readable before save');
insert into preview_test_ids values ('save', public.save_plate(pg_temp.preview_id('plate'),1,
  null,pg_temp.preview_id('preview')));
select pg_temp.preview_assert((select preview_asset_id = pg_temp.preview_id('preview')
  and snapshot_body = '' and snapshot_revision = 1 from public.menu_plate_saves
  where id = pg_temp.preview_id('save')), 'image-only save has a frozen preview');
select pg_temp.preview_assert((select count(*) = 1 from public.menu_preview_location(pg_temp.preview_id('save'))),
  'owner can locate own preview');
select pg_temp.preview_assert(private.can_read_menu_preview_object('menu-previews',
  pg_temp.preview_id('owner_profile')::text || '/' || pg_temp.preview_id('preview')::text || '.webp'),
  'saved preview is readable by owner');
select pg_temp.preview_assert(public.save_plate(pg_temp.preview_id('plate'),1,null,null)
  = pg_temp.preview_id('save'), 'repeat save keeps first preview');
select pg_temp.preview_expect(format('select public.save_plate(%L::uuid,1,null,%L::uuid)',
  pg_temp.preview_id('plate'), gen_random_uuid()), '23514');
select pg_temp.preview_assert(public.edit_plate(pg_temp.preview_id('plate'),1,pg_temp.preview_id('meal'),
  'Edited after save','[]','[]',array[pg_temp.preview_id('image')]) = 2,
  'Plate edit changes live revision');
select pg_temp.preview_assert((select snapshot_body = '' and snapshot_revision = 1
  and preview_asset_id = pg_temp.preview_id('preview') from public.menu_plate_saves
  where id = pg_temp.preview_id('save')), 'Menu copy and preview stay frozen');

select set_config('request.jwt.claim.sub', pg_temp.preview_id('outsider')::text, true);
select pg_temp.preview_assert((select count(*) = 0 from public.menu_preview_location(pg_temp.preview_id('save'))),
  'outsider cannot locate owner preview');
select pg_temp.preview_assert(not private.can_read_menu_preview_object('menu-previews',
  pg_temp.preview_id('owner_profile')::text || '/' || pg_temp.preview_id('preview')::text || '.webp'),
  'outsider cannot read owner preview');
select pg_temp.preview_expect(format('select public.save_plate(%L::uuid,2,null,%L::uuid)',
  pg_temp.preview_id('plate'),pg_temp.preview_id('preview')), '23514');
select pg_temp.preview_assert((select count(*) = 0 from public.menu_preview_jobs),
  'outsider cannot read owner jobs');

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.preview_expect($q$select id from public.menu_preview_assets$q$, '42501');
select 'PASS: private Menu preview lineage, frozen save, retries and access' as result;
