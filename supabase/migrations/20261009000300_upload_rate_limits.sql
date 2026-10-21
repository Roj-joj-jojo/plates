-- M4a upload resource limits. Counts every issued intent, including failed and
-- completed ones. A transaction advisory lock makes same-account checks atomic.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run upload rate limits with local migration role postgres';
  end if;
end $$;

create or replace function public.request_plate_upload()
returns table(intent_id uuid, staged_path text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.lock_content_actor(); fresh uuid := gen_random_uuid();
  checked_at timestamptz;
begin
  -- The profile guard above checks the actor; this lock serializes this actor's
  -- intent issuance without blocking uploads by unrelated accounts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 7343101));
  checked_at := clock_timestamp();
  if (select count(*) from public.media_upload_intents
      where uploader_id = actor and created_at > checked_at - interval '24 hours') >= 60 then
    raise exception 'Daily photo limit reached. Try again tomorrow' using errcode = 'P0001';
  end if;
  if (select count(*) from public.media_upload_intents
      where uploader_id = actor and created_at > checked_at - interval '1 hour') >= 12 then
    raise exception 'Hourly photo limit reached. Try again later' using errcode = 'P0001';
  end if;
  if (select count(*) from public.media_upload_intents
      where uploader_id = actor and state in ('pending', 'processing')
        and created_at > checked_at - interval '1 hour') >= 6 then
    raise exception 'Wait for your current photos to finish processing' using errcode = 'P0001';
  end if;
  insert into public.media_upload_intents(id, uploader_id, staged_path)
    values (fresh, actor, actor::text || '/' || fresh::text)
    returning id, media_upload_intents.staged_path into intent_id, staged_path;
  return next;
end $$;
commit;
