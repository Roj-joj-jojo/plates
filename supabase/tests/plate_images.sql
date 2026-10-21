-- Run after M4a in a surrounding transaction; all fixtures roll back.
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create temporary table media_test_ids(name text primary key, id uuid) on commit drop;
create temporary table media_test_paths(intent_id uuid, staged_path text) on commit drop;
create function pg_temp.media_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.media_test_ids where name = p_name;
$$;
create function pg_temp.media_assert(p_ok boolean, p_why text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if; end $$;
create function pg_temp.media_expect(p_sql text, p_code text) returns void language plpgsql as $$
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
grant select on media_test_ids to anon;
grant select, insert on media_test_ids to authenticated, service_role;
grant select, insert on media_test_paths to authenticated, service_role;
grant execute on function pg_temp.media_id(text), pg_temp.media_assert(boolean,text),
  pg_temp.media_expect(text,text) to authenticated, anon, service_role;

insert into auth.users(id,raw_user_meta_data)
  values (gen_random_uuid(),' {"display_name":"Media test author"}'::jsonb);
insert into media_test_ids select 'author', id from auth.users
  where raw_user_meta_data->>'display_name' = 'Media test author'
  order by created_at desc limit 1;
insert into media_test_ids select 'meal', id from public.categories where slug = 'meal';
select set_config('request.jwt.claim.sub',pg_temp.media_id('author')::text,true);
set local role authenticated;
insert into media_test_paths select intent_id, staged_path from public.request_plate_upload();
insert into media_test_ids select 'intent', intent_id from media_test_paths;
select pg_temp.media_assert((select state = 'pending' from public.media_upload_intents
  where id = pg_temp.media_id('intent')), 'author sees pending intent');
select pg_temp.media_assert((select private.can_upload_staged_path(staged_path) from media_test_paths),
  'author can use exactly the issued stage path');
select pg_temp.media_assert(not private.can_upload_staged_path('unissued/path'),
  'unissued stage path denied');
select pg_temp.media_expect($q$select public.finish_plate_upload(gen_random_uuid(), gen_random_uuid(),
  'invalid.webp', 100, 100)$q$, '42501');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
update public.media_upload_intents set state = 'processing'
  where id = pg_temp.media_id('intent');
insert into media_test_ids values ('asset',gen_random_uuid());
select public.finish_plate_upload(pg_temp.media_id('intent'), pg_temp.media_id('asset'),
  pg_temp.media_id('asset')::text || '.webp', 900, 600);
select pg_temp.media_assert((select state = 'ready' and asset_id = pg_temp.media_id('asset')
  from public.media_upload_intents where id = pg_temp.media_id('intent')), 'worker completion');

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
insert into media_test_ids values ('plate',public.publish_plate(pg_temp.media_id('meal'),'', '[]', '[]',
  array[pg_temp.media_id('asset')]));
select pg_temp.media_assert((select revision = 1 from public.plates
  where id = pg_temp.media_id('plate')), 'image-only Plate published');
select pg_temp.media_assert((select count(*) = 1 from public.plate_image_locations(pg_temp.media_id('plate'))),
  'author can locate attached image');
select pg_temp.media_assert((select count(*) = 1 from public.media_assets where id = pg_temp.media_id('asset')),
  'signed-in reader sees attached image metadata');
select pg_temp.media_assert(private.can_read_plate_object('plate-media',pg_temp.media_id('asset')::text || '.webp'),
  'attached Plate object is readable');
select pg_temp.media_assert(not private.can_read_plate_object('plate-media','unattached.webp'),
  'unattached served object denied');
select pg_temp.media_expect(format('select public.publish_plate(%L::uuid,%L,%L::jsonb,%L::jsonb,array[%L::uuid])',
  pg_temp.media_id('meal'),'again','[]','[]',pg_temp.media_id('asset')), '23514');
select pg_temp.media_expect(format('select public.publish_plate(%L::uuid,%L,%L::jsonb,%L::jsonb,array[%L::uuid,%L::uuid])',
  pg_temp.media_id('meal'),'duplicate','[]','[]',pg_temp.media_id('asset'),pg_temp.media_id('asset')), '23514');
select pg_temp.media_assert(public.edit_plate(pg_temp.media_id('plate'),1,pg_temp.media_id('meal'),
  'Photo with text','[]','[]',array[pg_temp.media_id('asset')]) = 2, 'editing image Plate increments revision');
select pg_temp.media_expect(format('select public.edit_plate(%L::uuid,2,%L::uuid,%L,%L::jsonb,%L::jsonb,ARRAY[]::uuid[])',
  pg_temp.media_id('plate'),pg_temp.media_id('meal'),'No image','[]','[]'), '23514');
select pg_temp.media_expect($q$insert into public.media_assets(id) values (gen_random_uuid())$q$, '42501');

reset role;
insert into auth.users(id,raw_user_meta_data)
  values (gen_random_uuid(),' {"display_name":"Media test outsider"}'::jsonb);
insert into media_test_ids select 'outsider', id from auth.users
  where raw_user_meta_data->>'display_name' = 'Media test outsider'
  order by created_at desc limit 1;
select set_config('request.jwt.claim.sub',pg_temp.media_id('outsider')::text,true);
set local role authenticated;
select pg_temp.media_assert(not (select private.can_upload_staged_path(staged_path) from media_test_paths),
  'another account cannot upload to the author stage path');
select pg_temp.media_expect(format('select public.publish_plate(%L::uuid,%L,%L::jsonb,%L::jsonb,array[%L::uuid])',
  pg_temp.media_id('meal'),'stolen','[]','[]',pg_temp.media_id('asset')), '23514');

set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.media_expect($q$select id from public.media_assets$q$, '42501');
select pg_temp.media_expect(format('select public.plate_image_locations(%L::uuid)',
  pg_temp.media_id('plate')), '42501');
select 'PASS: Plate media SQL permissions, publishing and revision checks' as result;
