-- REVIEW ONLY until separately approved. Retains all job records and files.
-- Requires owner-confirmed stopped/drained original worker.
-- Default is rollback; -v apply=true explicitly commits these four state changes.
\if :{?writer_stopped}
\else
  \set writer_stopped false
\endif
\if :writer_stopped
\else
  \echo 'Refused: confirm the original worker has stopped and outstanding requests have drained.'
  \quit 3
\endif
\if :{?apply}
\else
  \set apply false
\endif

begin;
set local statement_timeout='10s';
set local lock_timeout='3s';
create temporary table stalled_photo_targets(id uuid primary key, expected_update timestamptz) on commit drop;
insert into stalled_photo_targets values
  ('3859f384-2c7f-40e7-b40d-f3b2ff7f7daf','2026-10-10 15:01:18.420188+00'),
  ('b6f19c56-c13b-49a0-8540-75a0acfd7637','2026-10-10 15:43:42.215026+00'),
  ('ef2828b6-5b31-4605-9baa-d0d0b2508bc2','2026-10-10 16:08:22.433579+00'),
  ('2c050f78-6b90-45c0-8775-7f14eae0ad81','2026-10-10 21:35:41.892768+00');

select set_config('request.jwt.claim.role','service_role',true);
do $$
declare target record;
begin
  -- Match existing profile-before-intent guard ordering.
  perform 1 from public.profiles p where p.id in (
    select i.uploader_id from public.media_upload_intents i join stalled_photo_targets t on t.id=i.id
  ) order by p.id for share;
  perform 1 from public.media_upload_intents i join stalled_photo_targets t on t.id=i.id
    order by i.id for update of i;
  if (select count(*) from public.media_upload_intents i join stalled_photo_targets t on t.id=i.id
      where i.state='processing' and i.updated_at=t.expected_update and i.asset_id is null)<>4 then
    raise exception 'Target jobs changed; recovery refused';
  end if;
  if exists(select 1 from public.media_upload_intents i join stalled_photo_targets t on t.id=i.id
      join storage.objects s on s.bucket_id='staged-assets' and s.name=i.staged_path)
    or exists(select 1 from public.media_assets a join stalled_photo_targets t on t.id=a.source_intent_id) then
    raise exception 'Source or linked output found; recovery refused';
  end if;
  for target in select id from stalled_photo_targets order by id loop
    perform public.fail_plate_upload(target.id,'Upload could not be completed; please upload the photo again.');
  end loop;
  if (select count(*) from public.media_upload_intents i join stalled_photo_targets t on t.id=i.id
      where i.state='failed' and i.asset_id is null
        and i.error_message='Upload could not be completed; please upload the photo again.')<>4 then
    raise exception 'Failure outcome not confirmed; recovery refused';
  end if;
end $$;
select 'PASS exact four stalled uploads marked failed within this transaction' as result;
\if :apply
  commit;
  \echo 'Committed only the four approved upload state changes.'
\else
  rollback;
  \echo 'Dry run rolled back; no persistent job changes.'
\endif
