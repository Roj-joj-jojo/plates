\set ON_ERROR_STOP on
-- Owner-run, local only. Synthetic fixtures remain inside this transaction.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create temporary table m2_actors (
  name text primary key, auth_id uuid not null default gen_random_uuid(), profile_id uuid
) on commit drop;
insert into m2_actors(name) values ('owner'), ('member'), ('outsider'), ('disabled');
create temporary table m2_ids(name text primary key, id uuid not null) on commit drop;
create function pg_temp.m2_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.m2_ids where name = p_name;
$$;
create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$ begin
  if p_value is distinct from true then raise exception 'FAIL: %', p_message; end if;
end $$;
create function pg_temp.expect_error(p_sql text, p_code text, p_message text)
returns void language plpgsql as $$
declare actual_code text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate;
    if actual_code = p_code then return; end if;
    raise exception 'FAIL: %, expected %, got %: %', p_message, p_code, actual_code, sqlerrm;
  end;
  raise exception 'FAIL: % unexpectedly succeeded', p_message;
end $$;
do $$ begin
  execute format('grant usage on schema %I to authenticated, anon', pg_my_temp_schema()::regnamespace::text);
end $$;
grant select on m2_actors to authenticated, anon;
grant select, insert on m2_ids to authenticated;
grant select on m2_ids to anon;
grant execute on function pg_temp.m2_id(text), pg_temp.assert_true(boolean,text),
  pg_temp.expect_error(text,text,text) to authenticated, anon;

select pg_temp.assert_true(current_user = 'postgres', 'local postgres test role');
select pg_temp.assert_true((select count(*) = 3 from public.categories), 'three agreed categories');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.categories'::regclass,'public.plates'::regclass,'public.timeline_entries'::regclass,
   'public.plate_shares'::regclass,'public.threads'::regclass,'public.thread_replies'::regclass)), 'RLS on all M2 tables');
select pg_temp.assert_true((select bool_and('security_invoker=true' = any(reloptions)) from pg_class
  where oid in ('public.timeline_content'::regclass,'public.reply_content'::regclass)), 'invoker views');
select pg_temp.assert_true((select bool_and(p.prosecdef and r.rolname = 'postgres'
  and 'search_path=""' = any(p.proconfig)) from pg_proc p join pg_roles r on r.oid = p.proowner
  where p.oid in ('public.publish_plate(uuid,text,jsonb,jsonb,uuid[])'::regprocedure,
    'public.edit_plate(uuid,bigint,uuid,text,jsonb,jsonb,uuid[])'::regprocedure,
    'public.post_message(uuid,uuid,text,jsonb,uuid[])'::regprocedure,
    'public.share_plate(uuid,uuid,uuid,text,jsonb,uuid[])'::regprocedure,
    'public.reply_to_thread(uuid,uuid,text,jsonb,uuid[])'::regprocedure,
    'public.edit_timeline_entry(uuid,text,jsonb,uuid[])'::regprocedure,
    'public.edit_thread_reply(uuid,text,jsonb,uuid[])'::regprocedure)), 'RPC ownership and fixed search paths');

-- No email, sessions or passwords; the real Auth insert trigger creates profiles.
insert into auth.users(id,raw_user_meta_data)
  select auth_id,jsonb_build_object('display_name','M2 ' || name) from m2_actors;
update m2_actors a set profile_id = l.profile_id from private.profile_auth_links l where l.auth_user_id = a.auth_id;
insert into m2_ids select slug,id from public.categories;
select set_config('request.jwt.claim.sub',(select auth_id::text from m2_actors where name='owner'),true);
set local role authenticated;
insert into m2_ids values ('group',public.create_group('M2 test Table'));
insert into m2_ids values ('other_group',public.create_group('M2 other Table'));
insert into m2_ids values ('plate',public.publish_plate(pg_temp.m2_id('meal'),'Dinner','[]',
  '["  Comfort   Food  ","comfort food","Café","Café"]'));
insert into m2_ids values ('link_plate',public.publish_plate(pg_temp.m2_id('place'),'','["https://example.test/place"]'));
insert into m2_ids values ('recipe_plate',public.publish_plate(pg_temp.m2_id('recipe'),'How to cook dinner'));
select pg_temp.assert_true((select tags = '["comfort food","café"]'::jsonb from public.plates
  where id=pg_temp.m2_id('plate')), 'NFC, lowercase, collapsed and deduplicated tags');
select pg_temp.assert_true((select body='Dinner' and revision=1 from public.plates
  where id=pg_temp.m2_id('plate')), 'second Recipe does not alter original Meal');
select pg_temp.expect_error($q$select public.publish_plate(null,'Food')$q$,'23514','category required');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'   ')$q$,'23514','empty Plate rejected');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),repeat('x',20001))$q$,'23514','body bound');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food','[]','[null]')$q$,'23514','non-string tag');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food','[]',jsonb_build_array(repeat('a',41)))$q$,'23514','tag bound');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food','[]',
  '["a","b","c","d","e","f","g","h","i","j","k"]')$q$,'23514','tag count');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food','[]','[]',array[gen_random_uuid()])$q$,'23514','media cannot bypass unimplemented audience checks');

-- Bounds and URL parsing: all exercised through the public publishing operation.
do $$ declare bad text; begin
  foreach bad in array array['javascript:alert(1)','ftp://example.test','https:///missing',
    'https://user:password@example.test','https://example.test@evil.test',
    'https://example.test:99999','https://example.test:999999999999999999999',
    'https://[not-ip]/','https://999.999.999.999','https://example.test/%zz',
    'https://example.test/%0a','https://exa mple.test','https://example.test' || chr(92) || '@evil.test',
    'https://example.test/' || chr(10), 'https://example.test/' || repeat('x',2048)] loop
    perform pg_temp.expect_error(format('select public.publish_plate(%L::uuid,%L,%L::jsonb)',
      pg_temp.m2_id('meal'),'URL check',jsonb_build_array(bad)::text),'23514','unsafe/malformed URL');
  end loop;
end $$;
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food','[null]')$q$,'23514','link element type');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food',
  (select jsonb_agg('https://example.test/' || n) from generate_series(1,11) n))$q$,'23514','link count');
insert into m2_ids values ('valid_urls',public.publish_plate(pg_temp.m2_id('meal'),'',
  '["https://example.test/path?q=1#part","HTTP://localhost:54321/","https://127.0.0.1/","https://[::1]:443/","https://xn--caf-dma.example/café%20menu"]'));
insert into m2_ids values ('boundary_plate',public.publish_plate(pg_temp.m2_id('meal'),repeat('x',20000),
  (select jsonb_agg('https://example.test/' || repeat('x',2048-char_length('https://example.test/')))
    from generate_series(1,10)),
  (select jsonb_agg(lpad(n::text,40,'x')) from generate_series(1,10) n)));
select pg_temp.assert_true((select char_length(body)=20000 and jsonb_array_length(links)=10
  and jsonb_array_length(tags)=10 from public.plates where id=pg_temp.m2_id('boundary_plate')),
  'exact maximum body, link and tag bounds accepted');

insert into m2_ids values ('message_key',gen_random_uuid()),('share_key',gen_random_uuid()),('reply_key',gen_random_uuid());
insert into m2_ids values ('message',public.post_message(pg_temp.m2_id('group'),pg_temp.m2_id('message_key'),'Hello'));
select pg_temp.assert_true(public.post_message(pg_temp.m2_id('group'),pg_temp.m2_id('message_key'),'Hello')
  = pg_temp.m2_id('message'),'same message retry');
select pg_temp.expect_error($q$select public.post_message(pg_temp.m2_id('group'),pg_temp.m2_id('message_key'),'Changed')$q$,
  '23505','changed message retry');
select pg_temp.expect_error($q$select public.post_message(pg_temp.m2_id('group'),null,'Hello')$q$,'23514','request ID required');
select pg_temp.expect_error($q$select public.post_message(pg_temp.m2_id('group'),gen_random_uuid(),'')$q$,'23514','empty message');
insert into m2_ids values ('share',public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('plate'),pg_temp.m2_id('share_key')));
select pg_temp.assert_true(public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('plate'),pg_temp.m2_id('share_key'))
  = pg_temp.m2_id('share'),'same share retry');
select pg_temp.expect_error($q$select public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('recipe_plate'),pg_temp.m2_id('share_key'))$q$,
  '23505','different Plate with same share request');
select pg_temp.expect_error($q$select public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('plate'),pg_temp.m2_id('message_key'),'Hello')$q$,
  '23505','request key covers kind as well as body');
insert into m2_ids values ('second_share',public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('plate'),gen_random_uuid()));
insert into m2_ids select 'thread',id from public.threads where root_entry_id=pg_temp.m2_id('share');
insert into m2_ids select 'second_thread',id from public.threads where root_entry_id=pg_temp.m2_id('second_share');
select pg_temp.assert_true(pg_temp.m2_id('thread') <> pg_temp.m2_id('second_thread'),'repeat share has independent thread');
insert into m2_ids values ('reply',public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),'Looks good'));
select pg_temp.assert_true(public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),'Looks good')
  = pg_temp.m2_id('reply'),'same reply retry');
select pg_temp.expect_error($q$select public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),'Changed')$q$,
  '23505','changed reply retry');
select pg_temp.expect_error($q$select public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),
  'Looks good','["https://example.test"]')$q$,'23505','changed links on retry');
select pg_temp.expect_error($q$select public.reply_to_thread(pg_temp.m2_id('thread'),gen_random_uuid(),'')$q$,'23514','empty reply');
insert into m2_ids values ('other_reply',public.reply_to_thread(pg_temp.m2_id('second_thread'),pg_temp.m2_id('reply_key'),'',
  '["https://example.test/recipe"]'));
select pg_temp.assert_true((select array_agg(position order by position)=array[1,2,3]::bigint[]
  from public.timeline_content where group_id=pg_temp.m2_id('group')),'retries consume no timeline positions');
select pg_temp.assert_true((select position=1 from public.reply_content where id=pg_temp.m2_id('reply'))
  and (select position=1 from public.reply_content where id=pg_temp.m2_id('other_reply')),'independent per-thread positions');
select pg_temp.assert_true((select count(*)=2 from public.timeline_content
  where group_id=pg_temp.m2_id('group') and position>1),'cursor reads returned positions');

-- Editing preserves original retry identities, structural IDs and share revision.
select pg_temp.assert_true(public.edit_plate(pg_temp.m2_id('plate'),1,pg_temp.m2_id('meal'),'Dinner, improved','[]',
  '["comfort food","café"]')=2,'displayed edit bumps revision');
select pg_temp.assert_true(public.edit_plate(pg_temp.m2_id('plate'),2,pg_temp.m2_id('meal'),'Dinner, improved','[]',
  '["comfort food","café"]')=2,'no-op edit keeps revision');
select pg_temp.expect_error($q$select public.edit_plate(pg_temp.m2_id('plate'),1,pg_temp.m2_id('meal'),'Stale')$q$,
  '40001','stale edit conflicts');
select pg_temp.assert_true((select plate_revision_at_share=1 from public.plate_shares
  where entry_id=pg_temp.m2_id('share')),'share retains original revision');
select public.edit_timeline_entry(pg_temp.m2_id('message'),'Hello, edited');
select public.edit_thread_reply(pg_temp.m2_id('reply'),'Looks very good');
select pg_temp.assert_true(public.post_message(pg_temp.m2_id('group'),pg_temp.m2_id('message_key'),'Hello')=pg_temp.m2_id('message'),
  'original retry remains idempotent after edit');
select pg_temp.assert_true(public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),'Looks good')=pg_temp.m2_id('reply'),
  'reply retry remains idempotent after edit');
select pg_temp.assert_true((select body='Looks very good' from public.reply_content where id=pg_temp.m2_id('reply')),
  'retry does not undo edit');
select pg_temp.expect_error($q$select public.edit_plate(pg_temp.m2_id('plate'),2,pg_temp.m2_id('meal'),'')$q$,'23514','cannot remove last Plate content');
select pg_temp.expect_error($q$select public.edit_timeline_entry(pg_temp.m2_id('message'),'')$q$,'23514','cannot remove last message content');
select pg_temp.expect_error($q$select public.edit_thread_reply(pg_temp.m2_id('reply'),'')$q$,'23514','cannot remove last reply content');
reset role;
set constraints all immediate;
set constraints all deferred;

-- Privileged fixture membership follows profiles -> group before membership DML.
select id from public.profiles where id in (select profile_id from m2_actors) order by id for share;
select id from public.groups where id=pg_temp.m2_id('group') for update;
insert into public.group_memberships(group_id,user_id,role,state)
  select pg_temp.m2_id('group'),profile_id,'member','active' from m2_actors where name='member';
insert into public.membership_periods(group_id,user_id,joined_at)
  select pg_temp.m2_id('group'),profile_id,'2026-01-01T00:00:00Z' from m2_actors where name='member';
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub',(select auth_id::text from m2_actors where name='member'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=3 from public.timeline_content where group_id=pg_temp.m2_id('group')),'member sees full earlier history');
select pg_temp.assert_true((select count(*)=2 from public.reply_content where group_id=pg_temp.m2_id('group')),'member reads both discussions');
select pg_temp.expect_error($q$select auth_user_id from public.profiles$q$,'42703','Auth mapping not a profile column');
select pg_temp.expect_error($q$select * from private.profile_auth_links$q$,'42501','private mapping denied');
select pg_temp.expect_error($q$select client_request_id from public.timeline_entries$q$,'42501','timeline request ID hidden');
select pg_temp.expect_error($q$select request_fingerprint from public.timeline_entries$q$,'42501','timeline fingerprint hidden');
select pg_temp.expect_error($q$select client_request_id from public.thread_replies$q$,'42501','reply request ID hidden');
select pg_temp.expect_error($q$select id from public.thread_replies order by request_fingerprint$q$,'42501','hidden fingerprint cannot be ordered');
select pg_temp.expect_error($q$select id from public.timeline_entries where client_request_id=gen_random_uuid()$q$,'42501','hidden ID cannot be filtered');
select pg_temp.expect_error($q$select next_reply_position from public.threads$q$,'42501','reply counter hidden');
select pg_temp.expect_error($q$update public.groups set next_entry_position=42$q$,'42501','entry counter write denied');
select pg_temp.expect_error($q$update public.threads set next_reply_position=42$q$,'42501','reply counter write denied');
select pg_temp.expect_error($q$update public.timeline_entries set position=42$q$,'42501','entry position write denied');
select pg_temp.expect_error($q$update public.thread_replies set position=42$q$,'42501','reply position write denied');
select pg_temp.expect_error($q$update public.plates set revision=42$q$,'42501','revision write denied');
select pg_temp.expect_error($q$update public.plates set availability='removed'$q$,'42501','availability write denied');
select pg_temp.expect_error($q$update public.timeline_entries set availability='removed'$q$,'42501','entry availability write denied');
select pg_temp.expect_error($q$update public.thread_replies set availability='removed'$q$,'42501','reply availability write denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.plates','DELETE')
  and not has_table_privilege('authenticated','public.timeline_entries','TRUNCATE')
  and not has_table_privilege('service_role','public.thread_replies','SELECT'), 'no inherited destructive or broad service grants');
select pg_temp.expect_error($q$insert into public.plates(author_id,category_id,body) values
  ((select profile_id from m2_actors where name='owner'),pg_temp.m2_id('meal'),'Forged')$q$,'42501','direct insert/impersonation denied');
select pg_temp.expect_error($q$select public.edit_plate(pg_temp.m2_id('plate'),2,pg_temp.m2_id('meal'),'Not mine')$q$,'42501','cannot edit another author Plate');
select pg_temp.expect_error($q$select public.edit_timeline_entry(pg_temp.m2_id('message'),'Not mine')$q$,'42501','cannot edit another author message');
select pg_temp.expect_error($q$select public.edit_thread_reply(pg_temp.m2_id('reply'),'Not mine')$q$,'42501','cannot edit another author reply');
select pg_temp.expect_error($q$select private.lock_content_actor()$q$,'42501','private mutation helper cannot be called');
insert into m2_ids values ('member_reply',public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),'Member reply'));
select pg_temp.assert_true((select author_id=(select profile_id from m2_actors where name='member')
  and position=2 from public.reply_content where id=pg_temp.m2_id('member_reply')),'actor derived; same request key allowed for another author');
reset role;

select set_config('request.jwt.claim.sub',(select auth_id::text from m2_actors where name='outsider'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.plates where id=pg_temp.m2_id('plate')),'Plate readable without Table membership');
select pg_temp.assert_true((select count(*)=0 from public.timeline_content where group_id=pg_temp.m2_id('group')),'outsider view hides entries');
select pg_temp.assert_true((select count(id)=0 from public.timeline_entries where group_id=pg_temp.m2_id('group')),'outsider base RLS hides entries');
select pg_temp.assert_true((select count(entry_id)=0 from public.plate_shares where plate_id=pg_temp.m2_id('plate')),'Plate access does not expose share contexts');
select pg_temp.assert_true((select count(id)=0 from public.threads where group_id=pg_temp.m2_id('group')),'outsider cannot count threads');
select pg_temp.assert_true((select count(*)=0 from public.reply_content where group_id=pg_temp.m2_id('group')),'outsider cannot count replies');
select pg_temp.expect_error($q$select public.post_message(pg_temp.m2_id('group'),gen_random_uuid(),'Hello')$q$,'42501','outsider message denied');
select pg_temp.expect_error($q$select public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('plate'),gen_random_uuid())$q$,'42501','outsider share denied');
select pg_temp.expect_error($q$select public.reply_to_thread(pg_temp.m2_id('thread'),gen_random_uuid(),'Hello')$q$,'42501','outsider reply denied');
reset role;

-- Privileged direct invalid writes verify deferred constraints, not just RPCs.
select pg_temp.expect_error($q$do $case$ begin
  update public.plates set body='',links='[]' where id=pg_temp.m2_id('plate');
  set constraints all immediate;
end $case$;$q$,'23514','deferred Plate content');
select pg_temp.expect_error($q$do $case$ begin
  update public.thread_replies set body='',links='[]' where id=pg_temp.m2_id('reply');
  set constraints all immediate;
end $case$;$q$,'23514','deferred reply content');
select pg_temp.expect_error($q$do $case$ begin
  update public.timeline_entries set body='',links='[]' where id=pg_temp.m2_id('message');
  set constraints all immediate;
end $case$;$q$,'23514','deferred message content');
select pg_temp.expect_error($q$do $case$ begin
  insert into public.timeline_entries(group_id,author_id,kind,position,client_request_id,request_fingerprint)
    select pg_temp.m2_id('group'),profile_id,'plate_share',100,gen_random_uuid(),repeat('a',64) from m2_actors where name='owner';
  set constraints all immediate;
end $case$;$q$,'23514','orphan share root rejected');
select pg_temp.expect_error($q$do $case$ declare root_id uuid; begin
  insert into public.timeline_entries(group_id,author_id,kind,position,client_request_id,request_fingerprint)
    select pg_temp.m2_id('group'),profile_id,'plate_share',100,gen_random_uuid(),repeat('a',64)
    from m2_actors where name='owner' returning id into root_id;
  insert into public.plate_shares(entry_id,plate_id,plate_revision_at_share)
    values(root_id,pg_temp.m2_id('plate'),2);
  set constraints all immediate;
end $case$;$q$,'23514','share with detail but no thread rejected');
select pg_temp.expect_error($q$insert into public.plate_shares(entry_id,plate_id,plate_revision_at_share)
  values(pg_temp.m2_id('message'),pg_temp.m2_id('plate'),2)$q$,'23503','message cannot have share detail');
select pg_temp.expect_error($q$insert into public.threads(root_entry_id,group_id,root_kind)
  values(pg_temp.m2_id('message'),pg_temp.m2_id('group'),'plate_share')$q$,'23503','message cannot be thread root');
select pg_temp.expect_error($q$insert into public.thread_replies(thread_id,group_id,author_id,body,position,client_request_id,request_fingerprint)
  select pg_temp.m2_id('thread'),pg_temp.m2_id('other_group'),profile_id,'Wrong audience',100,gen_random_uuid(),repeat('a',64)
  from m2_actors where name='owner'$q$,'23503','reply cannot cross group');
select pg_temp.expect_error($q$update public.threads set root_entry_id=pg_temp.m2_id('second_share') where id=pg_temp.m2_id('thread')$q$,
  '23514','thread cannot be reparented');
select pg_temp.expect_error($q$update public.timeline_entries set position=100 where id=pg_temp.m2_id('message')$q$,'23514','position immutable even for privileged update');
select pg_temp.expect_error($q$update public.thread_replies set request_fingerprint=repeat('b',64) where id=pg_temp.m2_id('reply')$q$,'23514','retry fingerprint immutable');
select pg_temp.expect_error($q$update public.plates set revision=99 where id=pg_temp.m2_id('plate')$q$,'23514','revision cannot be assigned');
set constraints all immediate;
set constraints all deferred;

-- A failed statement after allocation must roll back its counter too.
select set_config('request.jwt.claim.sub',(select auth_id::text from m2_actors where name='owner'),true);
select pg_temp.expect_error($q$do $case$ begin
  perform public.post_message(pg_temp.m2_id('group'),gen_random_uuid(),'Will roll back');
  raise exception 'deliberate rollback' using errcode='P0001';
end $case$;$q$,'P0001','rollback allocated message');
select pg_temp.assert_true((select next_entry_position=4 from public.groups where id=pg_temp.m2_id('group')),'counter rolls back with message');
select pg_temp.expect_error($q$do $case$ begin
  perform public.reply_to_thread(pg_temp.m2_id('thread'),gen_random_uuid(),'Will roll back');
  raise exception 'deliberate rollback' using errcode='P0001';
end $case$;$q$,'P0001','rollback allocated reply');
select pg_temp.assert_true((select next_reply_position=3 from public.threads where id=pg_temp.m2_id('thread')),'counter rolls back with reply');

-- No removal RPC is enabled. This guarded fixture checks retained discussion
-- behaviour when a future authorised lifecycle operation unpublishes a Plate.
select id from public.plates where id=pg_temp.m2_id('plate') for update;
update public.plates set availability='removed' where id=pg_temp.m2_id('plate');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.plates where id=pg_temp.m2_id('plate')),'unpublished original hidden');
select pg_temp.assert_true((select count(entry_id)=2 from public.plate_shares where plate_id=pg_temp.m2_id('plate')),'shares retained');
select pg_temp.expect_error($q$select public.share_plate(pg_temp.m2_id('group'),pg_temp.m2_id('plate'),gen_random_uuid())$q$,'42501','cannot newly share unavailable Plate');
insert into m2_ids values ('after_unpublish',public.reply_to_thread(pg_temp.m2_id('thread'),gen_random_uuid(),'Discussion continues'));
reset role;

-- Permission is rechecked even with a formerly successful retry identity.
update public.membership_periods set ended_at='2026-02-01T00:00:00Z',end_reason='left'
  where group_id=pg_temp.m2_id('group') and user_id=(select profile_id from m2_actors where name='member');
update public.group_memberships set state='left'
  where group_id=pg_temp.m2_id('group') and user_id=(select profile_id from m2_actors where name='member');
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub',(select auth_id::text from m2_actors where name='member'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.reply_content where group_id=pg_temp.m2_id('group')),'former member loses reply read');
select pg_temp.expect_error($q$select public.reply_to_thread(pg_temp.m2_id('thread'),pg_temp.m2_id('reply_key'),'Member reply')$q$,
  '42501','former member retry denied');
reset role;
update public.profiles set state='disabled' where id=(select profile_id from m2_actors where name='disabled');
select set_config('request.jwt.claim.sub',(select auth_id::text from m2_actors where name='disabled'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.categories),'disabled caller has no category read');
select pg_temp.assert_true((select count(*)=0 from public.plates),'disabled caller has no Plate read');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food')$q$,'42501','disabled caller cannot publish');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.expect_error($q$select id from public.plates$q$,'42501','signed-out Plate read denied');
select pg_temp.expect_error($q$select * from public.timeline_content$q$,'42501','signed-out view read denied');
select pg_temp.expect_error($q$select public.publish_plate(pg_temp.m2_id('meal'),'Food')$q$,'42501','signed-out publish denied');
reset role;
set constraints all immediate;
rollback;
\echo PASS: M2 SQL acceptance checks completed; all fixtures rolled back
