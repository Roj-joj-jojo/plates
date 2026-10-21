begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.content_assert(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',why; end if; end $$;
create function pg_temp.content_expect(sql text,code text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute sql;
  exception when others then
    get stacked diagnostics actual=returned_sqlstate;
    if actual=code then return; end if;
    raise exception 'Expected %, got %',code,actual;
  end;
  raise exception 'Expected %, operation succeeded',code;
end $$;
create temporary table content_ids(label text primary key,id uuid);
create temporary table content_versions(label text primary key,stamp timestamptz);
grant select,insert on content_ids,content_versions to authenticated;
do $$ begin execute format('grant usage on schema %I to authenticated',pg_my_temp_schema()::regnamespace::text); end $$;
insert into content_ids values('admin_auth',gen_random_uuid()),('author_auth',gen_random_uuid()),('member_auth',gen_random_uuid()),('outsider_auth',gen_random_uuid());
update private.app_admission_settings set enabled=false where singleton;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  select id,'content-fixture-'||id||'@example.test',clock_timestamp(),'{"display_name":"Content control fixture"}' from content_ids;
insert into content_ids select replace(i.label,'_auth','_profile'),l.profile_id from content_ids i join private.profile_auth_links l on l.auth_user_id=i.id;
insert into private.profile_usernames(profile_id,username)
  select id,'Content'||replace(id::text,'-','')::varchar(20) from content_ids where label like '%_profile';
select pg_temp.content_assert(not has_function_privilege('anon','public.remove_table_content(uuid,timestamptz)','EXECUTE'),'anonymous removal denied');
select pg_temp.content_assert(not has_table_privilege('authenticated','public.timeline_entries','UPDATE'),'no direct content writes');
select pg_temp.content_assert(not has_function_privilege('service_role','public.unpublish_plate(uuid,bigint)','EXECUTE'),'service unpublish not granted');
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',(select id::text from content_ids where label='admin_auth'),true);
set local role authenticated;
insert into content_ids values('group',public.create_table_with_members('Content controls SQL fixture',array[(select id from content_ids where label='author_profile'),(select id from content_ids where label='member_profile')]));
select pg_temp.content_assert((select can_moderate from public.content_control_access((select id from content_ids where label='group'))),'Admin access');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from content_ids where label='author_auth'),true);
set local role authenticated;
select pg_temp.content_assert((select not can_moderate from public.content_control_access((select id from content_ids where label='group'))),'author is ordinary member');
insert into content_ids values('message_request',gen_random_uuid());
insert into content_ids values('message',public.post_message((select id from content_ids where label='group'),(select id from content_ids where label='message_request'),'Original message'));
insert into content_ids values('plate',public.publish_plate((select id from public.categories where slug='meal'),'Original saved Plate'));
insert into content_ids values('share',public.share_plate((select id from content_ids where label='group'),(select id from content_ids where label='plate'),gen_random_uuid(),'Original share note'));
insert into content_ids values('request',public.post_table_request((select id from content_ids where label='group'),gen_random_uuid(),'Original question'));
insert into content_ids select 'thread',id from public.threads where root_entry_id=(select id from content_ids where label='request');
insert into content_ids select 'share_thread',id from public.threads where root_entry_id=(select id from content_ids where label='share');
insert into content_ids values('reply',public.reply_to_thread((select id from content_ids where label='thread'),gen_random_uuid(),'Reply @['||(select id from content_ids where label='admin_profile')||']'));
insert into content_ids values('share_reply',public.reply_to_thread((select id from content_ids where label='share_thread'),gen_random_uuid(),'Retained share reply'));
insert into content_versions select 'message',updated_at from public.timeline_content where id=(select id from content_ids where label='message');
select public.edit_table_content((select id from content_ids where label='message'),(select stamp from content_versions where label='message'),'Changed message','[]');
select pg_temp.content_assert((select body='Changed message' and edited_at is not null from public.timeline_content where id=(select id from content_ids where label='message')),'author edit and Edited marker');
select pg_temp.content_expect($q$select public.edit_table_content((select id from content_ids where label='message'),(select stamp from content_versions where label='message'),'Stale edit')$q$,'40001');
select pg_temp.content_expect($q$select public.remove_table_content((select id from content_ids where label='message'),(select stamp from content_versions where label='message'))$q$,'40001');
select pg_temp.content_assert(public.post_message((select id from content_ids where label='group'),(select id from content_ids where label='message_request'),'Original message')=(select id from content_ids where label='message'),'original post retry stays stable after edit');
select public.edit_table_content((select id from content_ids where label='request'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='request')),'Updated context','[]','Updated question');
select pg_temp.content_assert((select question='Updated question' from public.requests where entry_id=(select id from content_ids where label='request')),'Request title editable');
select pg_temp.content_assert((select edited_at is not null from public.timeline_content where id=(select id from content_ids where label='request')),'Request Edited marker');
select pg_temp.content_expect($q$select public.edit_table_content((select id from content_ids where label='request'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='request')),'Context','[]','')$q$,'23514');
select public.edit_table_content((select id from content_ids where label='share'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='share')),'Updated share note');
select public.edit_table_reply((select id from content_ids where label='reply'),(select updated_at from public.reply_content where id=(select id from content_ids where label='reply')),'Edited reply @['||(select id from content_ids where label='admin_profile')||']');
select pg_temp.content_assert((select edited_at is not null from public.reply_content where id=(select id from content_ids where label='reply')),'reply Edited marker');
reset role;

-- Synthetic photo metadata only: no actual upload, file or Storage-object mutation.
insert into content_ids values('photo_intent',gen_random_uuid()),('photo_asset',gen_random_uuid());
insert into public.table_upload_intents(id,uploader_id,group_id,staged_path,state)
  values((select id from content_ids where label='photo_intent'),(select id from content_ids where label='author_profile'),(select id from content_ids where label='group'),'synthetic-content/'||gen_random_uuid(),'processing');
insert into public.table_media_assets(id,uploader_id,group_id,source_intent_id,bucket_id,object_path,media_type,width,height)
  values((select id from content_ids where label='photo_asset'),(select id from content_ids where label='author_profile'),(select id from content_ids where label='group'),(select id from content_ids where label='photo_intent'),'table-media','synthetic-content/'||(select id::text from content_ids where label='photo_asset')||'.webp','image/webp',100,100);
update public.table_upload_intents set state='ready',asset_id=(select id from content_ids where label='photo_asset') where id=(select id from content_ids where label='photo_intent');
set local role authenticated;
insert into content_ids values('photo_message',public.post_message((select id from content_ids where label='group'),gen_random_uuid(),'Photo text','[]',array[(select id from content_ids where label='photo_asset')]));
select public.edit_table_content((select id from content_ids where label='photo_message'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='photo_message')),'');
select pg_temp.content_assert((select count(*)=1 from public.table_image_locations((select id from content_ids where label='group')) where entry_id=(select id from content_ids where label='photo_message')),'text edit retains attached photo');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from content_ids where label='member_auth'),true);
set local role authenticated;
select pg_temp.content_expect($q$select public.remove_table_content((select id from content_ids where label='message'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='message')))$q$,'42501');
select pg_temp.content_expect($q$select public.remove_table_reply((select id from content_ids where label='reply'),(select updated_at from public.reply_content where id=(select id from content_ids where label='reply')))$q$,'42501');
select pg_temp.content_expect($q$select public.edit_table_content((select id from content_ids where label='message'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='message')),'Other words')$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from content_ids where label='outsider_auth'),true);
set local role authenticated;
select pg_temp.content_expect($q$select public.content_control_access((select id from content_ids where label='group'))$q$,'42501');
select pg_temp.content_expect($q$select public.remove_table_content((select id from content_ids where label='message'),clock_timestamp())$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from content_ids where label='admin_auth'),true);
set local role authenticated;
select pg_temp.content_expect($q$select public.edit_table_content((select id from content_ids where label='request'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='request')),'Admin words','[]','Admin question')$q$,'42501');
select pg_temp.content_expect($q$select public.edit_table_reply((select id from content_ids where label='reply'),(select updated_at from public.reply_content where id=(select id from content_ids where label='reply')),'Admin words')$q$,'42501');
select pg_temp.content_expect($q$select public.unpublish_plate((select id from content_ids where label='plate'),1)$q$,'42501');
insert into content_ids values('save',public.save_plate((select id from content_ids where label='plate'),1,(select id from content_ids where label='share')));
select public.remove_table_content((select id from content_ids where label='request'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='request')));
select public.remove_table_content((select id from content_ids where label='request'),clock_timestamp());
select pg_temp.content_assert((select availability='removed' and body='' and links='[]' from public.timeline_content where id=(select id from content_ids where label='request')),'Request original blanked, structure retained');
select pg_temp.content_assert((select question='Request removed.' from public.requests where entry_id=(select id from content_ids where label='request')),'removed question cleared');
select pg_temp.content_assert((select count(*)=1 from public.my_mention_notifications()),'available reply mention survives removed root');
select pg_temp.content_assert((select availability='available' from public.reply_content where id=(select id from content_ids where label='reply')),'reply retained');
select pg_temp.content_expect($q$select public.reply_to_thread((select id from content_ids where label='thread'),gen_random_uuid(),'New reply')$q$,'42501');
select public.remove_table_content((select id from content_ids where label='share'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='share')));
select pg_temp.content_assert((select body='Original saved Plate' from public.plates where id=(select id from content_ids where label='plate')),'share removal preserves original Plate');
select pg_temp.content_assert((select snapshot_body='Original saved Plate' from public.menu_plate_saves where id=(select id from content_ids where label='save')),'share removal preserves snapshot');
select public.remove_table_content((select id from content_ids where label='photo_message'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='photo_message')));
select pg_temp.content_assert((select count(*)=0 from public.table_image_locations((select id from content_ids where label='group'))),'removed photo no longer listed');
select pg_temp.content_assert(not private.can_read_table_object('table-media','synthetic-content/'||(select id::text from content_ids where label='photo_asset')||'.webp'),'removed photo access denied');
select public.remove_table_reply((select id from content_ids where label='reply'),(select updated_at from public.reply_content where id=(select id from content_ids where label='reply')));
select pg_temp.content_assert((select count(*)=0 from public.my_mention_notifications()),'removed reply mention disappears');
reset role;
select pg_temp.content_assert((select count(*)=1 from public.entry_media where entry_id=(select id from content_ids where label='photo_message')),'photo association retained without deletion');
select set_config('request.jwt.claim.sub',(select id::text from content_ids where label='author_auth'),true);
set local role authenticated;
select public.remove_table_content((select id from content_ids where label='message'),(select updated_at from public.timeline_content where id=(select id from content_ids where label='message')));
select pg_temp.content_expect($q$select public.edit_table_content((select id from content_ids where label='message'),clock_timestamp(),'Resurrect')$q$,'42501');
select public.unpublish_plate((select id from content_ids where label='plate'),1);
select public.unpublish_plate((select id from content_ids where label='plate'),1);
select pg_temp.content_assert((select count(*)=0 from public.plates where id=(select id from content_ids where label='plate')),'unpublished Plate unavailable');
reset role;
select pg_temp.content_assert((select availability='removed' and body='' from public.plates where id=(select id from content_ids where label='plate')),'Plate original blanked without deletion');
select pg_temp.content_assert((select availability='available' and snapshot_body='Original saved Plate' from public.menu_plate_saves where id=(select id from content_ids where label='save')),'unpublish preserves Menu snapshot');
select pg_temp.content_assert((select availability='available' and body='Retained share reply' from public.thread_replies where id=(select id from content_ids where label='share_reply')),'unpublish and share removal preserve replies');

-- Erasure must still blank a previously edited/removed Request through its established guard.
select set_config('request.jwt.claim.role','service_role',true);
insert into content_ids select 'erasure_op',operation_id from public.reserve_account_erasure_record((select id from content_ids where label='author_auth'));
select public.begin_recorded_account_erasure((select id from content_ids where label='erasure_op'),jsonb_build_object('sequence',1,'previous',repeat('0',64),'keyVersion','v1','event','intent','operationId',(select id from content_ids where label='erasure_op'),'profileToken',repeat('a',64),'authToken',repeat('b',64),'mac',repeat('c',64)));
select pg_temp.content_assert((select question='' from public.requests where entry_id=(select id from content_ids where label='request')),'recorded erasure still clears Request question');
set constraints all immediate;
select 'PASS content controls: author edits, Admin-only moderation, conflicts, retained replies/photos/snapshots, mention cleanup, media denial and erasure guard compatibility' as result;
rollback;
