-- Direct member additions, Admin controls and safe last-Admin departure.
begin;
create function public.find_table_user(p_username text)
returns table(profile_id uuid,username text,display_name text)
language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_profile_id() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  -- Exact handles only: no email lookup or unrelated-account browsing.
  return query select p.id,u.username,p.display_name from private.profile_usernames u
    join public.profiles p on p.id=u.profile_id
    where lower(u.username)=lower(ltrim(p_username,'@')) and p.state='active';
end $$;
create function public.table_members(p_group_id uuid)
returns table(profile_id uuid,username text,display_name text,role text,is_me boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_active_member(p_group_id) then raise exception 'Table membership required' using errcode='42501'; end if;
  return query select p.id,u.username,p.display_name,m.role,p.id=private.current_profile_id()
    from public.group_memberships m join public.profiles p on p.id=m.user_id
    left join private.profile_usernames u on u.profile_id=p.id
    where m.group_id=p_group_id and m.state='active' and p.state='active'
    order by (m.role='owner') desc,lower(coalesce(u.username,p.display_name)),p.id;
end $$;
create function private.add_table_member(p_group_id uuid,p_profile_id uuid) returns void
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.group_memberships where group_id=p_group_id and user_id=p_profile_id and state='active') then return; end if;
  insert into public.group_memberships(group_id,user_id,role,state) values(p_group_id,p_profile_id,'member','active')
    on conflict(group_id,user_id) do update set state='active',role='member';
  insert into public.membership_periods(group_id,user_id) values(p_group_id,p_profile_id);
end $$;
create function public.add_table_members(p_group_id uuid,p_profile_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); target uuid;
begin
  if actor is null or p_profile_ids is null or cardinality(p_profile_ids)>50 or array_position(p_profile_ids,null) is not null then
    raise exception 'Choose up to 50 accounts' using errcode='23514'; end if;
  perform 1 from public.profiles where id=actor or id=any(p_profile_ids) order by id for share;
  perform 1 from public.groups where id=p_group_id and availability='available' for update;
  if not found or not private.is_group_owner(p_group_id) then raise exception 'Table Admin required' using errcode='42501'; end if;
  for target in select distinct unnest(p_profile_ids) loop
    if not exists(select 1 from public.profiles p join private.profile_usernames u on u.profile_id=p.id
      where p.id=target and p.state='active' and u.username is not null) then
      raise exception 'Choose an active account with a username' using errcode='23514'; end if;
    perform private.add_table_member(p_group_id,target);
  end loop;
end $$;
create function public.create_table_with_members(p_name text,p_profile_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); result uuid;
begin
  if actor is null or p_profile_ids is null or cardinality(p_profile_ids)>50 or array_position(p_profile_ids,null) is not null then
    raise exception 'Choose up to 50 accounts' using errcode='23514'; end if;
  perform 1 from public.profiles where id=actor or id=any(p_profile_ids) order by id for share;
  result:=public.create_group(p_name);
  perform public.add_table_members(result,p_profile_ids);
  return result;
end $$;
create function public.set_table_admin(p_group_id uuid,p_profile_id uuid,p_admin boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); member_role text;
begin
  perform 1 from public.profiles where id in(actor,p_profile_id) order by id for share;
  perform 1 from public.groups where id=p_group_id and availability='available' for update;
  if not found or not private.is_group_owner(p_group_id) then raise exception 'Table Admin required' using errcode='42501'; end if;
  select role into member_role from public.group_memberships where group_id=p_group_id and user_id=p_profile_id and state='active';
  if member_role is null or p_admin is null then raise exception 'Active member required' using errcode='23514'; end if;
  if not p_admin and member_role='owner' and not exists(select 1 from public.group_memberships
    where group_id=p_group_id and user_id<>p_profile_id and state='active' and role='owner') then
    raise exception 'Assign another Admin first' using errcode='23514'; end if;
  update public.group_memberships set role=case when p_admin then 'owner' else 'member' end
    where group_id=p_group_id and user_id=p_profile_id;
end $$;
create function public.remove_table_member(p_group_id uuid,p_profile_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); target_role text;
begin
  perform 1 from public.profiles where id in(actor,p_profile_id) order by id for share;
  perform 1 from public.groups where id=p_group_id and availability='available' for update;
  if not found or not private.is_group_owner(p_group_id) or actor=p_profile_id then
    raise exception 'Admin must remove another member; use Leave for yourself' using errcode='42501'; end if;
  select role into target_role from public.group_memberships where group_id=p_group_id and user_id=p_profile_id and state='active';
  if target_role is null then return; end if;
  if target_role='owner' and not exists(select 1 from public.group_memberships where group_id=p_group_id
    and user_id<>p_profile_id and state='active' and role='owner') then raise exception 'Last Admin protected' using errcode='23514'; end if;
  update public.membership_periods set ended_at=greatest(clock_timestamp(),joined_at+interval '1 microsecond'),end_reason='removed'
    where group_id=p_group_id and user_id=p_profile_id and ended_at is null;
  update public.group_memberships set state='removed' where group_id=p_group_id and user_id=p_profile_id;
end $$;
create function public.leave_table(p_group_id uuid,p_replacement_id uuid default null,p_close boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.current_profile_id(); actor_role text; last_admin boolean; closing_members uuid[];
begin
  if actor is null or p_close is null or (p_close and p_replacement_id is not null) then raise exception 'Choose how to leave' using errcode='23514'; end if;
  if p_close then select array_agg(user_id) into closing_members from public.group_memberships where group_id=p_group_id and state='active'; end if;
  -- Closing affects every membership; lock every involved profile before the Table.
  perform 1 from public.profiles where id in(actor,p_replacement_id) or (p_close and id=any(closing_members)) order by id for share;
  perform 1 from public.groups where id=p_group_id and availability='available' for update;
  if not found or not private.is_active_member(p_group_id) then raise exception 'Table membership required' using errcode='42501'; end if;
  if p_close and exists(select 1 from public.group_memberships where group_id=p_group_id and state='active'
    and not(user_id=any(closing_members))) then raise exception 'Membership changed; review closure again' using errcode='40001'; end if;
  select role into actor_role from public.group_memberships where group_id=p_group_id and user_id=actor and state='active';
  last_admin:=actor_role='owner' and not exists(select 1 from public.group_memberships where group_id=p_group_id and user_id<>actor and role='owner' and state='active');
  if p_close then
    if not last_admin then raise exception 'Only the last Admin can close while leaving' using errcode='42501'; end if;
    update public.groups set availability='removed' where id=p_group_id;
    update public.membership_periods set ended_at=greatest(clock_timestamp(),joined_at+interval '1 microsecond'),end_reason='removed'
      where group_id=p_group_id and ended_at is null;
    update public.group_memberships set state='removed' where group_id=p_group_id and state='active';
    return;
  end if;
  if p_replacement_id is not null then
    if not last_admin or p_replacement_id=actor or not exists(select 1 from public.group_memberships m
      join public.profiles p on p.id=m.user_id where m.group_id=p_group_id and m.user_id=p_replacement_id and m.state='active' and p.state='active') then
      raise exception 'Choose another active member as Admin' using errcode='23514'; end if;
    update public.group_memberships set role='owner' where group_id=p_group_id and user_id=p_replacement_id;
  elsif last_admin then raise exception 'Assign a new Admin or close the Table' using errcode='23514'; end if;
  update public.membership_periods set ended_at=greatest(clock_timestamp(),joined_at+interval '1 microsecond'),end_reason='left'
    where group_id=p_group_id and user_id=actor and ended_at is null;
  update public.group_memberships set state='left' where group_id=p_group_id and user_id=actor;
end $$;
revoke all on function private.add_table_member(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.find_table_user(text),public.table_members(uuid),public.add_table_members(uuid,uuid[]),public.create_table_with_members(text,uuid[]),public.set_table_admin(uuid,uuid,boolean),public.remove_table_member(uuid,uuid),public.leave_table(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.find_table_user(text),public.table_members(uuid),public.add_table_members(uuid,uuid[]),public.create_table_with_members(text,uuid[]),public.set_table_admin(uuid,uuid,boolean),public.remove_table_member(uuid,uuid),public.leave_table(uuid,uuid,boolean) to authenticated;
commit;
