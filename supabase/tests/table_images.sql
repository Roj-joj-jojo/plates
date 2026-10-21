-- Run after M4c inside a surrounding transaction; all fixtures roll back.
set local statement_timeout = '20s';
set local lock_timeout = '3s';
create temporary table table_image_ids(name text primary key, id uuid) on commit drop;
create temporary table table_image_paths(name text primary key, intent_id uuid, staged_path text) on commit drop;
create function pg_temp.image_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.table_image_ids where name = p_name;
$$;
create function pg_temp.image_assert(p_ok boolean, p_why text) returns void language plpgsql as $$
begin if p_ok is distinct from true then raise exception 'FAIL: %', p_why; end if; end $$;
create function pg_temp.image_expect(p_sql text, p_code text) returns void language plpgsql as $$
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
grant select, insert on table_image_ids, table_image_paths to authenticated, service_role;
grant select on table_image_ids to anon;
grant execute on function pg_temp.image_id(text), pg_temp.image_assert(boolean,text),
  pg_temp.image_expect(text,text) to authenticated, anon, service_role;

insert into auth.users(id,raw_user_meta_data)
  values (gen_random_uuid(),'{"display_name":"Table image SQL owner"}'::jsonb);
insert into table_image_ids select 'owner', id from auth.users
  where raw_user_meta_data->>'display_name' = 'Table image SQL owner'
  order by created_at desc limit 1;
insert into table_image_ids select 'meal', id from public.categories where slug = 'meal';
select set_config('request.jwt.claim.sub',pg_temp.image_id('owner')::text,true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
insert into table_image_ids values ('group',public.create_group('Table image SQL test'));
insert into table_image_paths select 'message', intent_id, staged_path
  from public.request_table_upload(pg_temp.image_id('group'));
insert into table_image_ids select 'message_intent', intent_id from table_image_paths where name = 'message';
select pg_temp.image_assert((select private.can_upload_table_path(staged_path)
  from table_image_paths where name = 'message'), 'owner may upload to own Table stage');
select pg_temp.image_assert(not private.can_upload_table_path('not-issued'), 'unissued stage denied');
select pg_temp.image_expect($q$select public.finish_table_upload(gen_random_uuid(),gen_random_uuid(),
  'invalid.webp',100,100)$q$, '42501');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
update public.table_upload_intents set state = 'processing' where id = pg_temp.image_id('message_intent');
insert into table_image_ids values ('message_asset',gen_random_uuid());
select public.finish_table_upload(pg_temp.image_id('message_intent'),pg_temp.image_id('message_asset'),
  pg_temp.image_id('group')::text || '/' || pg_temp.image_id('message_asset')::text || '.webp',800,600);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
insert into table_image_ids values ('message_request',gen_random_uuid());
insert into table_image_ids values ('message',public.post_message(pg_temp.image_id('group'),
  pg_temp.image_id('message_request'),'', '[]',array[pg_temp.image_id('message_asset')]));
select pg_temp.image_assert(public.post_message(pg_temp.image_id('group'),
  pg_temp.image_id('message_request'),'', '[]',array[pg_temp.image_id('message_asset')])
  = pg_temp.image_id('message'), 'image-only message retry is idempotent');
select pg_temp.image_assert((select count(*) = 1 from public.table_image_locations(pg_temp.image_id('group'))
  where entry_id = pg_temp.image_id('message')), 'message photo appears in Table gallery');
select pg_temp.image_assert(private.can_read_table_object('table-media',
  pg_temp.image_id('group')::text || '/' || pg_temp.image_id('message_asset')::text || '.webp'),
  'attached Table object readable to member');
select pg_temp.image_expect(format('select public.post_message(%L::uuid,gen_random_uuid(),%L,%L::jsonb,
  array[%L::uuid])',pg_temp.image_id('group'),'again','[]',pg_temp.image_id('message_asset')), '23514');
select pg_temp.image_expect($q$insert into public.entry_media(entry_id,group_id,asset_id,position)
  values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1)$q$, '42501');

insert into table_image_ids values ('plate',public.publish_plate(pg_temp.image_id('meal'),'Source Plate'));
insert into table_image_ids values ('share',public.share_plate(pg_temp.image_id('group'),
  pg_temp.image_id('plate'),gen_random_uuid(),'Source'));
insert into table_image_ids select 'thread', id from public.threads where root_entry_id = pg_temp.image_id('share');
insert into table_image_paths select 'reply', intent_id, staged_path
  from public.request_table_upload(pg_temp.image_id('group'));
insert into table_image_ids select 'reply_intent', intent_id from table_image_paths where name = 'reply';
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
update public.table_upload_intents set state = 'processing' where id = pg_temp.image_id('reply_intent');
insert into table_image_ids values ('reply_asset',gen_random_uuid());
select public.finish_table_upload(pg_temp.image_id('reply_intent'),pg_temp.image_id('reply_asset'),
  pg_temp.image_id('group')::text || '/' || pg_temp.image_id('reply_asset')::text || '.webp',700,500);
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
insert into table_image_ids values ('reply_request',gen_random_uuid());
insert into table_image_ids values ('reply',public.reply_to_thread(pg_temp.image_id('thread'),
  pg_temp.image_id('reply_request'),'', '[]',array[pg_temp.image_id('reply_asset')]));
select pg_temp.image_assert(public.reply_to_thread(pg_temp.image_id('thread'),
  pg_temp.image_id('reply_request'),'', '[]',array[pg_temp.image_id('reply_asset')])
  = pg_temp.image_id('reply'), 'image-only reply retry is idempotent');
select pg_temp.image_assert((select count(*) = 2 from public.table_image_locations(pg_temp.image_id('group'))),
  'message and reply photos appear in Table gallery');
select pg_temp.image_expect(format('select public.reply_to_thread(%L::uuid,gen_random_uuid(),%L,
  %L::jsonb,array[%L::uuid])',pg_temp.image_id('thread'),'again','[]',pg_temp.image_id('reply_asset')),
  '23514');

-- The two completed Table attempts plus ten synthetic failed attempts exhaust
-- the shared hourly budget for both Table and Plate upload endpoints.
reset role;
insert into public.table_upload_intents(id,uploader_id,group_id,staged_path,state,error_message)
  select gen_random_uuid(), l.profile_id, pg_temp.image_id('group'), gen_random_uuid()::text,
    'failed', 'Synthetic rate-limit fixture'
    from generate_series(1,10) n
    cross join private.profile_auth_links l where l.auth_user_id = pg_temp.image_id('owner');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.image_expect($q$select * from public.request_plate_upload()$q$, 'P0001');
select pg_temp.image_expect(format('select * from public.request_table_upload(%L::uuid)',
  pg_temp.image_id('group')), 'P0001');

reset role;
insert into auth.users(id,raw_user_meta_data)
  values (gen_random_uuid(),'{"display_name":"Table image SQL outsider"}'::jsonb);
insert into table_image_ids select 'outsider', id from auth.users
  where raw_user_meta_data->>'display_name' = 'Table image SQL outsider'
  order by created_at desc limit 1;
select set_config('request.jwt.claim.sub',pg_temp.image_id('outsider')::text,true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.image_assert((select count(*) = 0 from public.table_image_locations(pg_temp.image_id('group'))),
  'outsider cannot list Table photo paths');
select pg_temp.image_assert(not private.can_read_table_object('table-media',
  pg_temp.image_id('group')::text || '/' || pg_temp.image_id('message_asset')::text || '.webp'),
  'outsider cannot read attached Table object');
select pg_temp.image_assert(not (select private.can_upload_table_path(staged_path)
  from table_image_paths where name = 'message'), 'outsider cannot use owner stage path');
select pg_temp.image_expect(format('select * from public.request_table_upload(%L::uuid)',
  pg_temp.image_id('group')), '42501');
select pg_temp.image_expect(format('select public.post_message(%L::uuid,gen_random_uuid(),%L,
  %L::jsonb,array[%L::uuid])',pg_temp.image_id('group'),'stolen','[]',pg_temp.image_id('reply_asset')),
  '42501');

set local role anon;
select set_config('request.jwt.claim.role','anon',true);
select pg_temp.image_expect(format('select * from public.table_image_locations(%L::uuid)',
  pg_temp.image_id('group')), '42501');
select 'PASS: Table image-only messages/replies, retries, member access and outsider denial' as result;
