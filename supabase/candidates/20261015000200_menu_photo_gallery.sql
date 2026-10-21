-- Candidate only; new saves capture all photos. No historical backfill/deletion.
begin;
create table private.menu_preview_batches (
  root_job_id uuid not null references public.menu_preview_jobs(id) on delete restrict,
  job_id uuid not null references public.menu_preview_jobs(id) on delete restrict,
  image_position integer not null check(image_position between 0 and 5),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(root_job_id,image_position), unique(root_job_id,job_id)
);
create table private.menu_saved_photos (
  save_id uuid not null references public.menu_plate_saves(id) on delete restrict,
  asset_id uuid not null references public.menu_preview_assets(id) on delete restrict,
  image_position integer not null check(image_position between 0 and 5),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(save_id,image_position), unique(save_id,asset_id)
);
alter table private.menu_preview_batches enable row level security;
alter table private.menu_saved_photos enable row level security;
revoke all on private.menu_preview_batches,private.menu_saved_photos from public,anon,authenticated,service_role;
create trigger menu_preview_batches_no_delete before delete on private.menu_preview_batches
  for each row execute function private.reject_m2_delete();
create trigger menu_saved_photos_no_delete before delete on private.menu_saved_photos
  for each row execute function private.reject_m2_delete();
create trigger menu_preview_batches_immutable before update on private.menu_preview_batches
  for each row execute function private.guard_record_update('root_job_id','job_id','image_position');
create trigger menu_saved_photos_immutable before update on private.menu_saved_photos
  for each row execute function private.guard_record_update('save_id','asset_id','image_position');

create function public.request_menu_gallery(p_plate_id uuid,p_expected_revision bigint)
returns table(job_id uuid,image_position integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); author_key uuid; current_plate public.plates%rowtype;
  total integer; root uuid; fresh uuid; photo record; first_asset uuid;
begin
  select author_id into author_key from public.plates where id=p_plate_id;
  perform 1 from public.profiles where id in(actor,author_key) order by id for share;
  if actor is null or private.current_profile_id() is distinct from actor or not private.can_view_plate(p_plate_id) then
    raise exception 'Plate unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,7343102));
  select * into current_plate from public.plates where id=p_plate_id and availability='available' for share;
  if not found then raise exception 'Plate unavailable' using errcode='42501'; end if;
  if p_expected_revision is distinct from current_plate.revision then
    raise exception 'Plate changed; refresh before saving' using errcode='40001'; end if;
  if exists(select 1 from public.menu_plate_saves where saver_id=actor and plate_id=p_plate_id) then
    raise exception 'Plate already saved' using errcode='23514'; end if;
  select count(*) into total from public.plate_media where plate_id=p_plate_id;
  if total not between 1 and 6 then raise exception 'Use one to six Plate photos' using errcode='23514'; end if;
  select asset_id into first_asset from public.plate_media where plate_id=p_plate_id order by position limit 1;
  select j.id into root from public.menu_preview_jobs j
    where j.saver_id=actor and j.plate_id=p_plate_id and j.source_revision=current_plate.revision
      and j.source_asset_id=first_asset and j.state in ('pending','processing','ready')
      and (select count(*) from private.menu_preview_batches b where b.root_job_id=j.id)=total
      and not exists(select 1 from private.menu_preview_batches b join public.menu_preview_jobs other on other.id=b.job_id
        where b.root_job_id=j.id and other.state='failed')
    order by j.created_at desc,j.id desc limit 1;
  if root is null then
    -- Charge each derived image against the existing per-account quotas.
    if (select count(*) from public.menu_preview_jobs where saver_id=actor and state in ('pending','processing')
      and created_at>clock_timestamp()-interval '1 hour')+total>6 then
      raise exception 'Too many unfinished Menu previews; try again later' using errcode='23514'; end if;
    if (select count(*) from public.menu_preview_jobs where saver_id=actor
      and created_at>clock_timestamp()-interval '1 hour')+total>12 then
      raise exception 'Menu preview limit reached for this hour' using errcode='23514'; end if;
    if (select count(*) from public.menu_preview_jobs where saver_id=actor
      and created_at>clock_timestamp()-interval '1 day')+total>60 then
      raise exception 'Menu preview limit reached for today' using errcode='23514'; end if;
    for photo in select pm.asset_id,(row_number() over(order by pm.position)-1)::integer image_position
      from public.plate_media pm where pm.plate_id=p_plate_id order by pm.position loop
      insert into public.menu_preview_jobs(saver_id,plate_id,source_asset_id,source_revision)
        values(actor,p_plate_id,photo.asset_id,current_plate.revision) returning id into fresh;
      root:=coalesce(root,fresh);
      insert into private.menu_preview_batches(root_job_id,job_id,image_position)
        values(root,fresh,photo.image_position);
    end loop;
  end if;
  return query select b.job_id,b.image_position from private.menu_preview_batches b
    where b.root_job_id=root order by b.image_position;
end $$;

create function private.capture_saved_gallery() returns trigger
language plpgsql security definer set search_path='' as $$
declare root uuid; total integer; matching integer;
begin
  select a.job_id into root from public.menu_preview_assets a where a.id=new.preview_asset_id;
  if root is null or not exists(select 1 from private.menu_preview_batches where root_job_id=root) then return new; end if;
  select count(*) into total from public.plate_media where plate_id=new.plate_id;
  select count(*) into matching from private.menu_preview_batches b
    join public.menu_preview_jobs j on j.id=b.job_id
    join public.menu_preview_assets a on a.id=j.preview_asset_id and a.job_id=j.id
    join (select pm.asset_id,(row_number() over(order by pm.position)-1)::integer pos
      from public.plate_media pm where pm.plate_id=new.plate_id) pm
      on pm.asset_id=j.source_asset_id and pm.pos=b.image_position
    where b.root_job_id=root and j.state='ready' and j.saver_id=new.saver_id and j.plate_id=new.plate_id
      and j.source_revision=new.snapshot_revision and a.saver_id=new.saver_id and a.plate_id=new.plate_id
      and a.source_asset_id=j.source_asset_id and a.source_revision=new.snapshot_revision;
  if total not between 1 and 6 or matching<>total
    or (select count(*) from private.menu_preview_batches where root_job_id=root)<>total then
    raise exception 'All saved photos must be ready before saving' using errcode='23514'; end if;
  insert into private.menu_saved_photos(save_id,asset_id,image_position)
    select new.id,j.preview_asset_id,b.image_position from private.menu_preview_batches b
      join public.menu_preview_jobs j on j.id=b.job_id where b.root_job_id=root;
  return new;
end $$;
create trigger menu_save_capture_gallery after insert on public.menu_plate_saves
  for each row execute function private.capture_saved_gallery();

create function public.menu_gallery_locations(p_save_id uuid)
returns table(asset_id uuid,object_path text,width integer,height integer,image_position integer)
language sql stable security definer set search_path='' as $$
  select a.id,a.object_path,a.width,a.height,g.image_position from public.menu_plate_saves s
    join private.menu_saved_photos g on g.save_id=s.id join public.menu_preview_assets a on a.id=g.asset_id
    where s.id=p_save_id and s.saver_id=private.current_profile_id() and s.availability='available'
  union all
  select a.id,a.object_path,a.width,a.height,0 from public.menu_plate_saves s
    join public.menu_preview_assets a on a.id=s.preview_asset_id
    where s.id=p_save_id and s.saver_id=private.current_profile_id() and s.availability='available'
      and not exists(select 1 from private.menu_saved_photos where save_id=s.id)
  order by image_position;
$$;
create or replace function private.can_read_menu_preview_object(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_bucket='menu-previews' and exists(select 1 from public.menu_preview_assets a
    join public.menu_plate_saves s on s.preview_asset_id=a.id
      or exists(select 1 from private.menu_saved_photos g where g.save_id=s.id and g.asset_id=a.id)
    where a.bucket_id=p_bucket and a.object_path=p_path
      and a.saver_id=s.saver_id and a.plate_id=s.plate_id
      and s.saver_id=private.current_profile_id() and s.availability='available');
$$;
revoke all on function public.request_menu_gallery(uuid,bigint),public.menu_gallery_locations(uuid),
  private.capture_saved_gallery() from public,anon,authenticated,service_role;
grant execute on function public.request_menu_gallery(uuid,bigint),public.menu_gallery_locations(uuid) to authenticated;
-- Existing erasure enumerates ALL menu_preview_assets by saver/source Plate and
-- revokes save availability. Gallery links add no text, identity fields or new bucket.
commit;
