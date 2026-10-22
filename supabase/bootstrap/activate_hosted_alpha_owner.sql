-- Owner-run trusted hosted bootstrap, not a migration or a seed.
-- Replace OWNER_EMAIL privately with the agreed dedicated owner's email.
-- Keep dashboard signup disabled. The DO statement is one atomic transaction.
do $$
declare
  selected_email text := 'OWNER_EMAIL';
  selected_profile uuid;
begin
  if current_user <> 'postgres' or selected_email = 'OWNER_EMAIL' then
    raise exception 'Use postgres and the reviewed owner email';
  end if;
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected only the newly created owner account';
  end if;
  select p.id into strict selected_profile
  from auth.users u
  join private.profile_auth_links l on l.auth_user_id=u.id
  join public.profiles p on p.id=l.profile_id
  where lower(btrim(u.email))=lower(btrim(selected_email))
    and u.email_confirmed_at is not null
    and p.state='active' and p.display_name='Dinnerfolk Admin';
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.activate_signup_allowlist(selected_profile);
end $$;

select enabled as allowlist_enabled,
  owner_profile_id is not null as owner_configured
from private.app_admission_settings where singleton;
