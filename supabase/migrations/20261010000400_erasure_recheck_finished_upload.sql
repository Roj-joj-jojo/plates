-- Recheck an affected object's absence after an in-flight upload settles.
-- It may have uploaded bytes after the cleanup worker's first removal.
begin;
create or replace function public.finish_media_object_attempt(p_bucket_id text, p_object_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media worker required' using errcode = '42501'; end if;
  -- Match the identity-advance lock order so it cannot finish between these updates.
  perform 1 from private.account_erasure_jobs j
    join private.account_erasure_objects o on o.profile_id = j.profile_id
    where o.bucket_id = p_bucket_id and o.object_path = p_object_path and j.state = 'cleaning'
    order by j.profile_id for update of j;
  update private.media_object_attempts set state = 'finished', finished_at = clock_timestamp()
    where bucket_id = p_bucket_id and object_path = p_object_path and state = 'processing';
  if not found then return; end if;
  update private.account_erasure_objects o
    set state = 'pending', last_error = null, updated_at = clock_timestamp()
    from private.account_erasure_jobs j
    where j.profile_id = o.profile_id and j.state = 'cleaning'
      and o.bucket_id = p_bucket_id and o.object_path = p_object_path;
  update private.account_erasure_jobs j set reconciled_at = null
    where j.state = 'cleaning' and exists (
      select 1 from private.account_erasure_objects o where o.profile_id = j.profile_id
        and o.bucket_id = p_bucket_id and o.object_path = p_object_path);
end $$;
commit;
