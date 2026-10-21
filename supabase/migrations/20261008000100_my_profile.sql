-- Additive identity projection for author-only controls in the connected app.
begin;
do $$ begin
  if current_user <> 'postgres' then
    raise exception 'Run the my_profile migration with the local migration role postgres';
  end if;
end $$;

-- Invoker security preserves profiles RLS and column grants. This view exposes
-- only the caller's app profile, not the private Auth-to-profile link.
create view public.my_profile with (security_invoker = true) as
  select id, display_name from public.profiles
  where id = (select private.current_profile_id());
revoke all on public.my_profile from public, anon, authenticated, service_role;
grant select on public.my_profile to authenticated;
commit;
