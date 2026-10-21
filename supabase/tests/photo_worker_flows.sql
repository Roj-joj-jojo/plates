-- Fixture-only DB contract tests: no Storage requests, image bytes or Auth deletion.
-- Candidate schema, admission setting and all fixture changes roll back together.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create function pg_temp.flow_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Photo flow assertion: %',label; end if; end $$;
create function pg_temp.flow_expect(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQL state: %',sqlstate;
  end;
  raise exception 'Expected refusal did not occur';
end $$;
create function pg_temp.flow_actor(actor uuid,kind text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(actor::text,''),true);
  perform set_config('request.jwt.claim.role',kind,true);
end $$;

do $$ begin
  if exists(select 1 from public.media_upload_intents where state='processing')
    or exists(select 1 from public.table_upload_intents where state='processing')
    or exists(select 1 from public.menu_preview_jobs where state='processing') then
    raise exception 'Existing photo processing work; fixture tests refused' using errcode='P7501';
  end if;
end $$;

-- Transaction-only admission bypass for two synthetic accounts, as existing tests use.
update private.app_admission_settings set enabled=false where singleton;
do $$
declare author_auth uuid:=gen_random_uuid(); saver_auth uuid:=gen_random_uuid();
  author uuid; saver uuid; group_key uuid; plate_key uuid; preview uuid; late_preview uuid;
  first_job uuid:=gen_random_uuid(); retry_job uuid:=gen_random_uuid(); late_job uuid:=gen_random_uuid();
  early_job uuid:=gen_random_uuid(); pending_job uuid:=gen_random_uuid(); table_job uuid:=gen_random_uuid();
  rejected_plate uuid:=gen_random_uuid(); rejected_table uuid:=gen_random_uuid(); rejected_preview uuid;
  run_key uuid:=gen_random_uuid(); next_run uuid:=gen_random_uuid();
  entry jsonb; before_retry jsonb; recovered jsonb; poll jsonb; source_asset uuid;
  hash text:=repeat('a',64); result uuid; operation_key uuid; save_key uuid;
begin
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    (author_auth,'photo-flow-'||author_auth||'@example.test',clock_timestamp(),'{"display_name":"Photo flow author fixture"}'),
    (saver_auth,'photo-flow-'||saver_auth||'@example.test',clock_timestamp(),'{"display_name":"Photo flow saver fixture"}');
  select profile_id into author from private.profile_auth_links where auth_user_id=author_auth;
  select profile_id into saver from private.profile_auth_links where auth_user_id=saver_auth;
  perform pg_temp.flow_assert(author is not null and saver is not null,'fixture profiles created');
  insert into private.profile_usernames(profile_id,username) values
    (author,'Photo'||left(replace(author::text,'-',''),20)),
    (saver,'Photo'||left(replace(saver::text,'-',''),20));

  perform pg_temp.flow_actor(author_auth,'authenticated');
  group_key:=public.create_table_with_members('Photo worker fixture',array[saver]);
  insert into public.media_upload_intents(id,uploader_id,staged_path)
    select id,author,author::text||'/'||id::text from unnest(array[first_job,retry_job,late_job,early_job,pending_job,rejected_plate]) id;
  insert into public.table_upload_intents(id,uploader_id,group_id,staged_path)
    values(table_job,author,group_key,author::text||'/'||table_job::text),
      (rejected_table,author,group_key,author::text||'/'||rejected_table::text);
  perform pg_temp.flow_assert(private.can_upload_staged_path(author::text||'/'||first_job::text),'pending source upload permitted');
  perform pg_temp.flow_actor(null,'service_role');
  perform public.photo_worker_open(run_key);
  poll:=public.photo_worker_poll(run_key);
  perform pg_temp.flow_assert(jsonb_typeof(poll->'jobs')='array' and jsonb_array_length(poll->'jobs')<=10,'poll contract');

  -- No legacy unjournalled claim, no complete-before-prepare, bounded metadata.
  perform set_config('private.photo_worker_claim','',true);
  perform pg_temp.flow_expect(format('update public.media_upload_intents set state=''processing'' where id=%L::uuid',first_job),'42501');
  entry:=public.photo_worker_claim(run_key,'plate',first_job);
  source_asset:=(entry->>'asset_id')::uuid;
  perform pg_temp.flow_assert(public.photo_worker_claim(run_key,'plate',first_job)=entry,'claim retry identity');
  perform pg_temp.flow_expect(format('select public.photo_worker_complete(%L::uuid,''plate'',%L::uuid)',run_key,first_job),'23514');
  perform pg_temp.flow_expect(format('select public.photo_worker_prepare(%L::uuid,''plate'',%L::uuid,%L,100,2049,100)',run_key,first_job,hash),'23514');
  perform public.photo_worker_prepare(run_key,'plate',first_job,hash,100,512,512);
  perform pg_temp.flow_expect(format('select public.photo_worker_reject(%L::uuid,''plate'',%L::uuid)',run_key,first_job),'23514');
  perform pg_temp.flow_assert(exists(select 1 from private.media_object_attempts where bucket_id=entry->>'bucket'
    and object_path=entry->>'object_path' and state='processing'),'attempt acknowledged before output');
  perform pg_temp.flow_expect(format('select public.photo_worker_prepare(%L::uuid,''plate'',%L::uuid,%L,100,512,512)',run_key,first_job,repeat('b',64)),'23514');
  perform public.photo_worker_complete(run_key,'plate',first_job);
  perform public.photo_worker_complete(run_key,'plate',first_job);
  perform pg_temp.flow_assert((select count(*)=1 from public.media_assets where source_intent_id=first_job),'one Plate asset after repeat completion');
  perform pg_temp.flow_assert((select state='ready' and asset_id=source_asset from public.media_upload_intents where id=first_job),'Plate ready identity');
  perform pg_temp.flow_assert(exists(select 1 from private.media_object_attempts where bucket_id=entry->>'bucket'
    and object_path=entry->>'object_path' and state='finished'),'completed attempt finished');
  perform pg_temp.flow_actor(author_auth,'authenticated');
  perform pg_temp.flow_assert(not private.can_upload_staged_path(author::text||'/'||first_job::text),'completed source cannot be uploaded again');
  plate_key:=public.publish_plate((select id from public.categories where slug='meal'),'Photo worker fixture','[]','[]',array[source_asset]);
  perform pg_temp.flow_actor(saver_auth,'authenticated');
  preview:=public.request_menu_preview(plate_key,1);
  perform pg_temp.flow_actor(null,'service_role');

  entry:=public.photo_worker_claim(run_key,'table',table_job);
  perform pg_temp.flow_assert(entry->>'bucket'='table-media' and entry->>'object_path'=group_key::text||'/'||(entry->>'asset_id')||'.webp','Table output namespace');
  perform public.photo_worker_prepare(run_key,'table',table_job,hash,100,512,512);
  perform public.photo_worker_complete(run_key,'table',table_job);
  perform public.photo_worker_complete(run_key,'table',table_job);
  perform pg_temp.flow_assert((select count(*)=1 from public.table_media_assets where source_intent_id=table_job),'one Table asset');

  entry:=public.photo_worker_claim(run_key,'preview',preview);
  perform pg_temp.flow_assert(entry->>'bucket'='menu-previews' and entry->>'object_path'=saver::text||'/'||(entry->>'asset_id')||'.webp','preview output namespace');
  perform pg_temp.flow_expect(format('select public.photo_worker_prepare(%L::uuid,''preview'',%L::uuid,%L,100,641,100)',run_key,preview,hash),'23514');
  perform public.photo_worker_prepare(run_key,'preview',preview,hash,100,320,320);
  perform public.photo_worker_complete(run_key,'preview',preview);
  perform public.photo_worker_complete(run_key,'preview',preview);
  perform pg_temp.flow_assert((select count(*)=1 from public.menu_preview_assets where job_id=preview),'one preview asset');
  perform pg_temp.flow_actor(saver_auth,'authenticated');
  save_key:=public.save_plate(plate_key,1,null,(entry->>'asset_id')::uuid);
  perform pg_temp.flow_assert((select preview_asset_id=(entry->>'asset_id')::uuid from public.menu_plate_saves where id=save_key),'Menu save links ready preview');
  perform pg_temp.flow_actor(null,'service_role');

  -- Reject only unprepared jobs; retries/lost block replies must keep them terminal.
  insert into public.menu_preview_jobs(saver_id,plate_id,source_asset_id,source_revision)
    values(saver,plate_key,source_asset,1) returning id into rejected_preview;
  perform pg_temp.flow_assert(not has_function_privilege('authenticated','public.photo_worker_reject(uuid,text,uuid)','EXECUTE'),'reader cannot reject');
  for result in select unnest(array[rejected_plate,rejected_table,rejected_preview]) loop
    if result=rejected_plate then entry:=public.photo_worker_claim(run_key,'plate',result);
      perform public.photo_worker_reject(run_key,'plate',result);
      perform public.photo_worker_reject(run_key,'plate',result);
      perform public.photo_worker_block(run_key,'plate',result,'decode');
    elsif result=rejected_table then entry:=public.photo_worker_claim(run_key,'table',result);
      perform public.photo_worker_reject(run_key,'table',result);
      perform public.photo_worker_reject(run_key,'table',result);
    else entry:=public.photo_worker_claim(run_key,'preview',result);
      perform public.photo_worker_reject(run_key,'preview',result);
      perform public.photo_worker_reject(run_key,'preview',result);
    end if;
    perform pg_temp.flow_assert((select phase='rejected' and sha256 is null from private.photo_worker_journal
      where job_id=result),'rejection terminal without preparation');
    perform pg_temp.flow_assert(not exists(select 1 from private.media_object_attempts
      where bucket_id=entry->>'bucket' and object_path=entry->>'object_path'),'rejection has no output attempt');
  end loop;
  perform pg_temp.flow_assert((select state='failed' and asset_id is null and error_message is not null
    from public.media_upload_intents where id=rejected_plate),'failed Plate outcome');
  perform pg_temp.flow_assert((select state='failed' and asset_id is null and error_message is not null
    from public.table_upload_intents where id=rejected_table),'failed Table outcome');
  perform pg_temp.flow_assert((select state='failed' and preview_asset_id is null and error_message is not null
    from public.menu_preview_jobs where id=rejected_preview),'failed preview outcome');
  perform pg_temp.flow_assert(public.photo_worker_close(run_key),'terminal failures allow clean shutdown');
  run_key:=gen_random_uuid();
  perform public.photo_worker_open(run_key);
  perform pg_temp.flow_assert((select count(*)=3 from private.photo_worker_journal where phase='rejected'),'fresh run does not reopen rejected jobs');

  -- Simulated acknowledged preparation followed by interrupted writer, metadata only.
  perform public.photo_worker_claim(run_key,'plate',retry_job);
  before_retry:=public.photo_worker_prepare(run_key,'plate',retry_job,hash,100,512,512);
  perform public.photo_worker_block(run_key,'plate',retry_job,'upload_uncertain');
  perform pg_temp.flow_assert(public.photo_worker_close(run_key)=false,'unfinished run cannot release ownership');
  perform public.photo_worker_open(next_run,run_key,true,true);
  recovered:=public.photo_worker_claim(next_run,'plate',retry_job);
  perform pg_temp.flow_assert(recovered->>'asset_id'=before_retry->>'asset_id'
    and recovered->>'object_path'=before_retry->>'object_path' and recovered->>'sha256'=hash
    and recovered->>'phase'='prepared','prepared recovery identity/hash');
  perform pg_temp.flow_expect(format('select public.photo_worker_complete(%L::uuid,''plate'',%L::uuid)',run_key,retry_job),'40001');
  perform public.photo_worker_complete(next_run,'plate',retry_job);
  perform public.photo_worker_complete(next_run,'plate',retry_job);
  perform pg_temp.flow_assert((select count(*)=1 from public.media_assets where source_intent_id=retry_job),'one recovered asset');

  -- Prepared and pre-prepare work when the source author starts erasure.
  perform public.photo_worker_claim(next_run,'plate',late_job);
  entry:=public.photo_worker_prepare(next_run,'plate',late_job,hash,100,512,512);
  perform public.photo_worker_claim(next_run,'plate',early_job);
  insert into public.menu_preview_jobs(saver_id,plate_id,source_asset_id,source_revision)
    values(saver,plate_key,source_asset,1) returning id into late_preview;
  perform public.photo_worker_claim(next_run,'preview',late_preview);
  perform public.photo_worker_prepare(next_run,'preview',late_preview,hash,100,320,320);
  -- Structurally valid synthetic receipt, never a real independently signed record.
  -- This exercises DB cutoff/tracking through the trusted wrapper, not ledger crypto.
  select operation_id into operation_key from public.reserve_account_erasure_record(author_auth);
  result:=public.begin_recorded_account_erasure(operation_key,jsonb_build_object(
    'event','intent','operationId',operation_key,'keyVersion','v1','sequence',1,
    'profileToken',repeat('0',64),'authToken',repeat('0',64),
    'previous',repeat('0',64),'mac',repeat('0',64)));
  perform pg_temp.flow_assert(result=author,'fixture author erasure initiated');
  perform pg_temp.flow_actor(null,'service_role');
  perform pg_temp.flow_expect(format('select public.photo_worker_claim(%L::uuid,''plate'',%L::uuid)',next_run,pending_job),'42501');
  perform pg_temp.flow_expect(format('select public.photo_worker_prepare(%L::uuid,''plate'',%L::uuid,%L,100,512,512)',next_run,early_job,hash),'42501');
  perform pg_temp.flow_expect(format('select public.photo_worker_complete(%L::uuid,''plate'',%L::uuid)',next_run,late_job),'42501');
  perform pg_temp.flow_expect(format('select public.photo_worker_complete(%L::uuid,''preview'',%L::uuid)',next_run,late_preview),'42501');
  perform pg_temp.flow_assert(not exists(select 1 from public.media_assets where source_intent_id in(late_job,early_job,pending_job)),'no late author assets');
  perform pg_temp.flow_assert(not exists(select 1 from public.menu_preview_assets where job_id=late_preview),'no late source preview');
  perform pg_temp.flow_assert((select availability='erased' and preview_asset_id is null from public.menu_plate_saves where id=save_key),'source erasure clears saved preview reference');
  perform pg_temp.flow_assert(exists(select 1 from private.account_erasure_objects where profile_id=author
    and bucket_id=entry->>'bucket' and object_path=entry->>'object_path'),'prepared output included in erasure');
  perform pg_temp.flow_assert(exists(select 1 from private.account_erasure_objects e join private.photo_worker_journal j
    on e.bucket_id=j.bucket and e.object_path=j.object_path where e.profile_id=author and j.kind='preview' and j.job_id=late_preview),'unfinished preview included in source erasure');
  perform pg_temp.flow_assert(exists(select 1 from private.media_object_attempts where bucket_id=entry->>'bucket'
    and object_path=entry->>'object_path' and state='processing'),'denied completion preserves unfinished attempt');
end $$;
-- Force deferred fixture content constraints before reporting success.
set constraints all immediate;
select 'PASS photo worker flows (fixture DB metadata only; rolled back)' as result;
rollback;
