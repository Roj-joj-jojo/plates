\set ON_ERROR_STOP on
-- Owner-run local suite. No fixture commits, email, reset or cleanup operation.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create temporary table m3_actors (
  name text primary key, auth_id uuid not null default gen_random_uuid(), profile_id uuid
) on commit drop;
insert into m3_actors(name) values ('author'), ('saver'), ('second_saver'), ('outsider'), ('disabled');
create temporary table m3_ids(name text primary key, id uuid not null) on commit drop;
create temporary table m3_captures(name text primary key, payload jsonb not null) on commit drop;
create function pg_temp.m3_id(p_name text) returns uuid language sql as $$
  select id from pg_temp.m3_ids where name = p_name;
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
grant select on m3_actors to authenticated, anon;
grant select, insert on m3_ids, m3_captures to authenticated;
grant select on m3_ids to anon;
grant execute on function pg_temp.m3_id(text), pg_temp.assert_true(boolean,text),
  pg_temp.expect_error(text,text,text) to authenticated, anon;

select pg_temp.assert_true(current_user='postgres','local postgres test role');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.menu_plate_saves'::regclass,'public.menu_plate_sources'::regclass)), 'Menu RLS enabled');
select pg_temp.assert_true((select 'security_invoker=true'=any(reloptions) from pg_class
  where oid='public.menu_source_context'::regclass),'source context uses invoker rights');
select pg_temp.assert_true((select bool_and(p.prosecdef and r.rolname='postgres'
  and 'search_path=""'=any(p.proconfig)) from pg_proc p join pg_roles r on r.oid=p.proowner
  where p.oid in ('public.save_plate(uuid,bigint,uuid,uuid)'::regprocedure,
    'public.add_menu_source(uuid,uuid)'::regprocedure,
    'private.lock_menu_source(uuid,uuid)'::regprocedure)), 'RPC ownership and fixed paths');

insert into auth.users(id,raw_user_meta_data)
  select auth_id,jsonb_build_object('display_name','M3 ' || name) from m3_actors;
update m3_actors a set profile_id=l.profile_id from private.profile_auth_links l where l.auth_user_id=a.auth_id;
-- Namespace category labels separately from Plate labels to avoid M2's collision.
insert into m3_ids select 'category_' || slug,id from public.categories;
select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='author'),true);
set local role authenticated;
insert into m3_ids values ('table',public.create_group('M3 visible Table'));
insert into m3_ids values ('hidden_table',public.create_group('M3 hidden Table'));
insert into m3_ids values ('plate',public.publish_plate(pg_temp.m3_id('category_meal'),'Original dinner',
  '["https://example.test/original"]','["Comfort Food"]'));
insert into m3_ids values ('other_plate',public.publish_plate(pg_temp.m3_id('category_recipe'),'How to cook it'));
insert into m3_ids values ('race_plate',public.publish_plate(pg_temp.m3_id('category_meal'),'Before edit'));
insert into m3_ids values ('link_plate',public.publish_plate(pg_temp.m3_id('category_place'),'','["https://example.test/place"]'));
insert into m3_ids values ('unsaved_plate',public.publish_plate(pg_temp.m3_id('category_meal'),'Not yet saved'));
insert into m3_ids values ('share',public.share_plate(pg_temp.m3_id('table'),pg_temp.m3_id('plate'),gen_random_uuid(),'First discussion'));
insert into m3_ids values ('second_share',public.share_plate(pg_temp.m3_id('table'),pg_temp.m3_id('plate'),gen_random_uuid(),'Another discussion'));
insert into m3_ids values ('third_share',public.share_plate(pg_temp.m3_id('table'),pg_temp.m3_id('plate'),gen_random_uuid(),'Third discussion'));
insert into m3_ids values ('other_share',public.share_plate(pg_temp.m3_id('table'),pg_temp.m3_id('other_plate'),gen_random_uuid()));
insert into m3_ids values ('race_share',public.share_plate(pg_temp.m3_id('table'),pg_temp.m3_id('race_plate'),gen_random_uuid()));
insert into m3_ids values ('hidden_share',public.share_plate(pg_temp.m3_id('hidden_table'),pg_temp.m3_id('plate'),gen_random_uuid()));
insert into m3_ids values ('hidden_unsaved_share',public.share_plate(pg_temp.m3_id('hidden_table'),pg_temp.m3_id('unsaved_plate'),gen_random_uuid()));
insert into m3_ids select 'thread',id from public.threads where root_entry_id=pg_temp.m3_id('share');
select public.reply_to_thread(pg_temp.m3_id('thread'),gen_random_uuid(),'Discussion content');
reset role;
select id from public.profiles where id in (select profile_id from m3_actors) order by id for share;
select id from public.groups where id=pg_temp.m3_id('table') for update;
insert into public.group_memberships(group_id,user_id,role,state)
  select pg_temp.m3_id('table'),profile_id,'member','active' from m3_actors where name in ('saver','second_saver');
insert into public.membership_periods(group_id,user_id,joined_at)
  select pg_temp.m3_id('table'),profile_id,'2026-01-01T00:00:00Z' from m3_actors where name in ('saver','second_saver');
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='saver'),true);
set local role authenticated;
insert into m3_ids values ('save',public.save_plate(pg_temp.m3_id('plate'),1));
select pg_temp.assert_true((select snapshot_body='Original dinner' and snapshot_links='["https://example.test/original"]'::jsonb
  and snapshot_tags='["comfort food"]'::jsonb and snapshot_revision=1
  and snapshot_category_id=pg_temp.m3_id('category_meal') and snapshot_category_label='Meal'
  and snapshot_author_name='M3 author' and original_author_id=(select profile_id from m3_actors where name='author')
  and saver_id=(select profile_id from m3_actors where name='saver')
  from public.menu_plate_saves where id=pg_temp.m3_id('save')),'snapshot captures content, labels and derived actor');
insert into m3_captures select 'snapshot',to_jsonb(s) from public.menu_plate_saves s where id=pg_temp.m3_id('save');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_sources where save_id=pg_temp.m3_id('save')),'feed save has no discussion source');
select pg_temp.assert_true(public.save_plate(pg_temp.m3_id('plate'),999)=pg_temp.m3_id('save'),'repeat ignores stale first-save revision');
select pg_temp.assert_true(public.save_plate(pg_temp.m3_id('plate'),null)=pg_temp.m3_id('save'),'repeat does not require first-save revision');
select pg_temp.assert_true(public.save_plate(pg_temp.m3_id('plate'),1,pg_temp.m3_id('share'))=pg_temp.m3_id('save'),'explicit discussion save adds source to existing reminder');
select pg_temp.assert_true(public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('second_share'))=pg_temp.m3_id('save'),'second discussion source');
insert into m3_captures select 'source',to_jsonb(s) from public.menu_plate_sources s
  where save_id=pg_temp.m3_id('save') and share_entry_id=pg_temp.m3_id('share');
select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('share'));
select public.save_plate(pg_temp.m3_id('plate'),0,pg_temp.m3_id('share'));
select pg_temp.assert_true((select count(*)=2 from public.menu_plate_sources where save_id=pg_temp.m3_id('save')),'duplicate sources add no rows');
select pg_temp.assert_true((select to_jsonb(s)=(select payload from m3_captures where name='source')
  from public.menu_plate_sources s where save_id=pg_temp.m3_id('save') and share_entry_id=pg_temp.m3_id('share')),'repeat source preserves added time');
select pg_temp.assert_true((select to_jsonb(s)=(select payload from m3_captures where name='snapshot')
  from public.menu_plate_saves s where id=pg_temp.m3_id('save')),'repeat saves preserve entire snapshot and times');
select pg_temp.assert_true((select source_available and group_name='M3 visible Table' and introduction='First discussion'
  and sharer_name='M3 author' and thread_id=pg_temp.m3_id('thread') from public.menu_source_context
  where save_id=pg_temp.m3_id('save') and share_entry_id=pg_temp.m3_id('share')),'authorised source context resolves');
select id from public.reply_content where thread_id=pg_temp.m3_id('thread');
select pg_temp.assert_true((select count(*)=2 from public.menu_plate_sources where save_id=pg_temp.m3_id('save')),'viewing discussion does not add a source');
insert into m3_ids values ('link_save',public.save_plate(pg_temp.m3_id('link_plate'),1));
select pg_temp.assert_true((select snapshot_body='' and jsonb_array_length(snapshot_links)=1
  from public.menu_plate_saves where id=pg_temp.m3_id('link_save')),'link-only reminder');

select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('other_share'))$q$,'42501','source must share same Plate');
select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('hidden_share'))$q$,'42501','guessed hidden source denied');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('unsaved_plate'),1,pg_temp.m3_id('hidden_unsaved_share'))$q$,'42501','inaccessible first-save source fails atomically');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_saves where plate_id=pg_temp.m3_id('unsaved_plate')),'no partial reminder after denied source');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('unsaved_plate'),1,null,gen_random_uuid())$q$,'23514','preview cannot bypass unimplemented media checks');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('unsaved_plate'),null)$q$,'40001','first save requires revision');
select pg_temp.expect_error($q$select public.save_plate(gen_random_uuid(),1)$q$,'42501','unknown Plate');
select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('save'),null)$q$,'42501','source argument required');
select pg_temp.expect_error($q$select private.lock_menu_source(pg_temp.m3_id('share'),pg_temp.m3_id('plate'))$q$,'42501','private helper denied');
select pg_temp.expect_error($q$update public.menu_plate_saves set snapshot_body='Forged'$q$,'42501','client snapshot rewrite denied');
select pg_temp.expect_error($q$update public.menu_plate_saves set saver_id=(select profile_id from m3_actors where name='outsider')$q$,'42501','client ownership rewrite denied');
select pg_temp.expect_error($q$update public.menu_plate_saves set availability='erased'$q$,'42501','client availability rewrite denied');
select pg_temp.expect_error($q$insert into public.menu_plate_sources(save_id,share_entry_id,plate_id)
  values(pg_temp.m3_id('save'),pg_temp.m3_id('hidden_share'),pg_temp.m3_id('plate'))$q$,'42501','direct source write denied');
select pg_temp.expect_error($q$insert into public.menu_plate_saves(saver_id,plate_id,snapshot_revision,snapshot_body,
  snapshot_links,snapshot_tags,snapshot_category_id,snapshot_category_label,original_author_id,snapshot_author_name)
  select profile_id,pg_temp.m3_id('other_plate'),1,'Forged','[]','[]',pg_temp.m3_id('category_recipe'),'Recipe',profile_id,'Forged'
  from m3_actors where name='outsider'$q$,'42501','direct snapshot insert/impersonation denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.menu_plate_saves','DELETE')
  and not has_table_privilege('authenticated','public.menu_plate_sources','TRUNCATE')
  and not has_table_privilege('service_role','public.menu_plate_saves','SELECT'),'no inherited removal or broad service grants');
reset role;
set constraints all immediate;
set constraints all deferred;

-- Another active member owns a separate capture; neither may read the other's.
select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='second_saver'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_saves where id=pg_temp.m3_id('save')),'member cannot read another Menu');
select pg_temp.assert_true((select count(*)=0 from public.menu_source_context where save_id=pg_temp.m3_id('save')),'member cannot resolve another Menu sources');
insert into m3_ids values ('second_save',public.save_plate(pg_temp.m3_id('plate'),1,pg_temp.m3_id('share')));
select pg_temp.assert_true(pg_temp.m3_id('second_save')<>pg_temp.m3_id('save'),'different savers retain distinct reminders');
select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('third_share'))$q$,'42501','cannot add source to another saver');
reset role;
select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='outsider'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_sources),'outsider sees no saved references');
insert into m3_ids values ('outsider_save',public.save_plate(pg_temp.m3_id('plate'),1));
select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('outsider_save'),pg_temp.m3_id('share'))$q$,'42501','feed access grants no Table access');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_sources),'denied source leaves feed reminder source-free');
reset role;

-- Live edits and renames do not propagate into existing reminders.
select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='author'),true);
set local role authenticated;
select public.update_display_name('M3 renamed author');
select public.edit_plate(pg_temp.m3_id('plate'),1,pg_temp.m3_id('category_recipe'),'Changed dinner',
  '["https://example.test/changed"]','["new tag"]');
select public.edit_plate(pg_temp.m3_id('race_plate'),1,pg_temp.m3_id('category_meal'),'After edit');
reset role;
-- Trusted category-label fixture is transaction-local and rolled back at end.
select id from public.categories where id=pg_temp.m3_id('category_meal') for update;
update public.categories set label='Meal renamed' where id=pg_temp.m3_id('category_meal');
select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='saver'),true);
set local role authenticated;
select pg_temp.assert_true((select to_jsonb(s)=(select payload from m3_captures where name='snapshot')
  from public.menu_plate_saves s where id=pg_temp.m3_id('save')),'live content/category/author changes cannot refresh snapshot');
select pg_temp.assert_true(public.save_plate(pg_temp.m3_id('plate'),1)=pg_temp.m3_id('save'),'old displayed revision accepted for existing reminder');
select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('third_share'));
select pg_temp.assert_true((select to_jsonb(s)=(select payload from m3_captures where name='snapshot')
  from public.menu_plate_saves s where id=pg_temp.m3_id('save')),'adding source after edits never refreshes snapshot');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('race_plate'),1,pg_temp.m3_id('race_share'))$q$,'40001','stale first save rejected');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_saves where plate_id=pg_temp.m3_id('race_plate')),'stale first save leaves no reminder');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_sources where share_entry_id=pg_temp.m3_id('race_share')),'stale first save leaves no source');
insert into m3_ids values ('race_save',public.save_plate(pg_temp.m3_id('race_plate'),2,pg_temp.m3_id('race_share')));
select pg_temp.assert_true((select snapshot_body='After edit' and snapshot_revision=2
  and snapshot_author_name='M3 renamed author' and snapshot_category_label='Meal renamed'
  from public.menu_plate_saves where id=pg_temp.m3_id('race_save')),'new save captures current guarded revision and labels');
reset role;
set constraints all immediate;
set constraints all deferred;

-- Privileged writes verify the schema independently of denied client writes.
select pg_temp.expect_error($q$update public.menu_plate_saves set snapshot_body='Refresh'
  where id=pg_temp.m3_id('save')$q$,'23514','snapshot immutable even in privileged DML');
select pg_temp.expect_error($q$update public.menu_plate_saves set saved_at=clock_timestamp()
  where id=pg_temp.m3_id('save')$q$,'23514','save time immutable');
select pg_temp.expect_error($q$update public.menu_plate_sources set share_entry_id=pg_temp.m3_id('hidden_share')
  where save_id=pg_temp.m3_id('save') and share_entry_id=pg_temp.m3_id('share')$q$,'23514','source cannot be reparented');
select pg_temp.expect_error($q$insert into public.menu_plate_sources(save_id,share_entry_id,plate_id)
  values(pg_temp.m3_id('save'),pg_temp.m3_id('other_share'),pg_temp.m3_id('plate'))$q$,'23503','share composite FK requires same Plate');
select pg_temp.expect_error($q$insert into public.menu_plate_sources(save_id,share_entry_id,plate_id)
  values(pg_temp.m3_id('save'),pg_temp.m3_id('other_share'),pg_temp.m3_id('other_plate'))$q$,'23503','save composite FK requires same Plate');
select pg_temp.expect_error($q$insert into public.menu_plate_saves(saver_id,plate_id,snapshot_revision,snapshot_body,
  snapshot_links,snapshot_tags,snapshot_category_id,snapshot_category_label,original_author_id,snapshot_author_name)
  select saver_id,plate_id,snapshot_revision,snapshot_body,snapshot_links,snapshot_tags,snapshot_category_id,
    snapshot_category_label,original_author_id,snapshot_author_name from public.menu_plate_saves where id=pg_temp.m3_id('save')$q$,
  '23505','unique saver/Plate enforced independently of RPC');
select pg_temp.expect_error($q$do $case$ begin
  insert into public.menu_plate_saves(saver_id,plate_id,snapshot_revision,snapshot_body,
    snapshot_links,snapshot_tags,snapshot_category_id,snapshot_category_label,original_author_id,snapshot_author_name)
    select profile_id,pg_temp.m3_id('unsaved_plate'),1,'','[]','[]',pg_temp.m3_id('category_meal'),'Meal',
      (select profile_id from m3_actors where name='author'),'M3 renamed author'
    from m3_actors where name='saver';
  set constraints all immediate;
end $case$;$q$,'23514','empty snapshot rejected at transaction boundary');
select pg_temp.expect_error($q$do $case$ begin
  perform public.save_plate(pg_temp.m3_id('unsaved_plate'),1);
  raise exception 'deliberate rollback' using errcode='P0001';
end $case$;$q$,'P0001','save rolls back with transaction');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_saves where plate_id=pg_temp.m3_id('unsaved_plate')),'no partial save after transaction failure');
select pg_temp.expect_error($q$do $case$ begin
  perform public.save_plate(pg_temp.m3_id('other_plate'),1,pg_temp.m3_id('other_share'));
  raise exception 'deliberate rollback' using errcode='P0001';
end $case$;$q$,'P0001','reminder and source roll back together');
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_saves where plate_id=pg_temp.m3_id('other_plate'))
  and (select count(*)=0 from public.menu_plate_sources where share_entry_id=pg_temp.m3_id('other_share')),
  'no partial reminder or source after transaction failure');

-- Membership departure fixture holds the profiles and Table guards established
-- above. Source joins must lose labels, introduction, sharer and thread together.
update public.membership_periods set ended_at='2026-02-01T00:00:00Z',end_reason='left'
  where group_id=pg_temp.m3_id('table') and user_id=(select profile_id from m3_actors where name='saver');
update public.group_memberships set state='left'
  where group_id=pg_temp.m3_id('table') and user_id=(select profile_id from m3_actors where name='saver');
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claim.sub',(select auth_id::text from m3_actors where name='saver'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.menu_plate_saves where id=pg_temp.m3_id('save')),'former member keeps reminder');
select pg_temp.assert_true((select count(*)=3 from public.menu_plate_sources where save_id=pg_temp.m3_id('save')),'former member keeps reference stubs');
select pg_temp.assert_true((select count(*)=3 and bool_and(not source_available and group_id is null and group_name is null
  and sharer_id is null and sharer_name is null and introduction is null and introduction_links is null and thread_id is null)
  from public.menu_source_context where save_id=pg_temp.m3_id('save')),'former member receives no resolved source context');
select pg_temp.assert_true((select count(*)=0 from public.reply_content where thread_id=pg_temp.m3_id('thread')),'saved reference grants no reply access');
select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('share'))$q$,'42501','source retry rechecks membership');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('plate'),1,pg_temp.m3_id('share'))$q$,'42501','save with source rechecks membership');
select pg_temp.assert_true(public.save_plate(pg_temp.m3_id('plate'),1)=pg_temp.m3_id('save'),'source-free repeat still returns reminder');
reset role;
insert into public.membership_periods(group_id,user_id,joined_at)
  select pg_temp.m3_id('table'),profile_id,'2026-02-01T00:00:00Z' from m3_actors where name='saver';
update public.group_memberships set state='active'
  where group_id=pg_temp.m3_id('table') and user_id=(select profile_id from m3_actors where name='saver');
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
select pg_temp.assert_true((select count(*)=3 and bool_and(source_available) from public.menu_source_context
  where save_id=pg_temp.m3_id('save')),'rejoin resolves original sources without new references');
reset role;

-- Future ordinary unpublish fixture; no lifecycle endpoint is enabled.
select id from public.plates where id in (pg_temp.m3_id('plate'),pg_temp.m3_id('unsaved_plate')) order by id for update;
update public.plates set availability='removed' where id in (pg_temp.m3_id('plate'),pg_temp.m3_id('unsaved_plate'));
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.plates where id=pg_temp.m3_id('plate')),'unpublished original hidden');
select pg_temp.assert_true((select to_jsonb(s)=(select payload from m3_captures where name='snapshot')
  from public.menu_plate_saves s where id=pg_temp.m3_id('save')),'unpublishing preserves complete snapshot');
select pg_temp.assert_true(public.save_plate(pg_temp.m3_id('plate'),-1)=pg_temp.m3_id('save'),'existing reminder returned after unpublish');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('unsaved_plate'),1)$q$,'42501','new save of unavailable Plate denied');
select pg_temp.expect_error($q$select public.add_menu_source(pg_temp.m3_id('save'),pg_temp.m3_id('share'))$q$,'42501','source additions for unavailable Plate deferred');
select pg_temp.assert_true((select count(*)=3 and bool_and(source_available) from public.menu_source_context
  where save_id=pg_temp.m3_id('save')),'existing discussion context survives Plate unpublish');
reset role;

-- Disabled and anonymous users cannot use another person's or their own Menu.
update public.profiles set state='disabled' where id=(select profile_id from m3_actors where name='saver');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.menu_plate_saves),'disabled caller loses Menu read');
select pg_temp.assert_true((select count(*)=0 from public.menu_source_context),'disabled caller loses source view');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('link_plate'),1)$q$,'42501','disabled save denied');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.expect_error($q$select * from public.menu_plate_saves$q$,'42501','anonymous Menu read denied');
select pg_temp.expect_error($q$select * from public.menu_source_context$q$,'42501','anonymous context read denied');
select pg_temp.expect_error($q$select public.save_plate(pg_temp.m3_id('link_plate'),1)$q$,'42501','anonymous save denied');
reset role;
set constraints all immediate;
rollback;
\echo PASS: M3 SQL acceptance checks completed; all fixtures rolled back
