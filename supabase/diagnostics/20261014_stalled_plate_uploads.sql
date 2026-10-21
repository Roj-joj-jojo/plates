-- Approved read-only diagnosis of the four 10 October processing Plate uploads.
-- No image bytes, user details, credential fields or mutations.
begin read only;
set local statement_timeout='5s';
set local lock_timeout='3s';
select i.id as job_id, i.state, i.created_at, i.updated_at,
  i.staged_path, i.asset_id as intent_asset_id,
  s.id is not null as source_metadata_present,
  s.created_at as source_created_at, s.updated_at as source_updated_at,
  s.metadata->>'size' as source_size_bytes,
  s.metadata->>'mimetype' as source_media_type,
  a.id as linked_asset_id, a.object_path as linked_output_path,
  a.width, a.height, o.id is not null as output_metadata_present,
  (select count(*) from public.plate_media pm where pm.asset_id=a.id) as plate_attachment_count
from public.media_upload_intents i
left join storage.objects s on s.bucket_id='staged-assets' and s.name=i.staged_path
left join public.media_assets a on a.source_intent_id=i.id
left join storage.objects o on o.bucket_id=a.bucket_id and o.name=a.object_path
where i.state='processing'
  and i.updated_at >= timestamptz '2026-10-10 15:01:18+00'
  and i.updated_at <= timestamptz '2026-10-10 21:35:42+00'
order by i.updated_at, i.id;
rollback;
