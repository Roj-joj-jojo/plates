-- Limit profile names to the caller, visible Plate authors and active Table peers.
-- The existing policy name is retained; no profile records are changed.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run profile visibility migration with the local migration role postgres';
  end if;
end $$;

create or replace function private.can_read_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.profile_auth_links own_link
      join public.profiles own_profile on own_profile.id = own_link.profile_id
      where own_link.auth_user_id = (select auth.uid())
        and own_profile.state = 'active'
        and (
          own_profile.id = p_profile_id
          or exists (select 1 from public.plates p
            where p.author_id = p_profile_id and p.availability = 'available')
          or exists (
            select 1 from public.group_memberships mine
              join public.group_memberships peer on peer.group_id = mine.group_id
              join public.groups g on g.id = mine.group_id
              where mine.user_id = own_profile.id and mine.state = 'active'
                and peer.user_id = p_profile_id and peer.state = 'active'
                and g.availability = 'available'
          )
        )
  );
$$;
revoke all on function private.can_read_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_read_profile(uuid) to authenticated;

alter policy profiles_signed_in_read on public.profiles to authenticated
  using (state = 'active' and private.can_read_profile(id));
commit;
