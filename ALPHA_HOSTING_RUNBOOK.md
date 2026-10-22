# Alpha hosting preparation — 21 October 2026

## Current checkpoint

**Current summary — 22 October:** Owner supplied Vercel Valid Configuration for dinnerfolk.app and www.dinnerfolk.app and confirms the custom address loads the sign-in screen. Apex redirects to www, which serves Production; successful owner sign-in/admin access was previously reported on dinnerfolk.vercel.app, but custom-domain authenticated acceptance is not separately confirmed. Owner reports main created from published prototype-foundation, made GitHub default and selected for Vercel Production Branch Tracking. Owner reports main ruleset saved; plan eligibility/enforcement not independently verified. Local hosting changes are being reviewed on owner-created codex/hosted-alpha-setup before a separate Dinnerfolk rebrand. Railway has not been set up; official incident QH8L8B3E showed paused signups and unavailable Hobby builds when checked this session. Worker and remaining hosted photo/security/backup/operator gates remain pending. Keep signup closed. Earlier setup/domain-pending checkpoints below are historical and superseded by this summary; no agent remote/Git/deployment action.

**Latest hosted acceptance — 22 October:** Owner reports normal website sign-in succeeds with real numeric-code email and owner admin management is visible with only dedicated owner listed. Returning-owner OTP/email and scoped admin UI therefore passed; new-user confirmation template/direct-unlisted-admission, two-account/image/worker and other release gates remain. Next owner add dinnerfolk.app in Vercel Settings→Domains and review exact DNS records before Cloudflare edits. Preserve Resend email DNS. No domain attachment/TLS or Railway worker success claimed; keep signup closed/tester invitations pending.

**Latest — 22 October:** Owner supplies successful Vercel deployment screen with rendered sign-in preview. Import selected prototype-foundation; build log shows Next16.3.8 and `npm run build -- --webpack`. Hosted Supabase33 migrations, structural checks and verified owner/allowlist activation passed as owner-reported. Live URL/exact build revision and browser OTP/owner access not yet checked; code-email discrepancy unresolved. Next open Visit and test existing-owner Sign in while signup stays off. Domain binding, Railway worker, hosted photos/two-account access, backup/operator gates and Dinnerfolk UI branding remain pending. Earlier setup-pending notes below are historical.

**Vercel/Auth checkpoint — 21 October:** Owner reports Vercel account created; no repository import/deployment reported. Hosted signup off, custom SMTP and Site URL saved, six-digit OTP setting confirmed. Owner screenshot shows Magic link or OTP template contains Dinnerfolk subject/body and `{{ .Token }}`; instructed matching Confirm signup template, but its save was not explicitly evidenced. No actual delivery test. Next release task is reconciling local installed features and migration history before fresh-schema rehearsal.

**Supabase checkpoint — 21 October:** Owner dashboard screenshot shows Dinnerfolk Free organisation, Plates' Project Healthy/Nano, Stockholm region, no linked repository or recorded migrations/backups. Region/name accepted for preparation; no project recreation proposed. Schema/data not independently inspected. Next owner action: close public signup temporarily in Authentication → Sign In / Providers and confirm saved; not yet reported complete. Keep anonymous signup off and email confirmation on. Resend receiving-off state confirmed. No hosted database installation, SMTP integration, owner bootstrap or actual email delivery verified.

**Resend checkpoint — 21 October:** Owner completed account/domain setup using Cloudflare auto-configuration. Supplied screenshot shows DKIM and both sending CNAMEs Verified; sending enabled and receiving disabled. Onboarding key was masked; agent has not accessed or stored it, and private custody is not confirmed. Tracking-off advice remains to verify; no actual test email or hosted SMTP integration. Next owner-guided step is Supabase Free account creation/sign-in, then stop at dashboard before project setup. This supersedes the earlier pending Resend/DNS statements below; agent performed no external configuration.

**Latest — 21 October:** Owner reports purchasing **dinnerfolk.app** and choosing Dinnerfolk as brand direction. Intended primary address is `https://dinnerfolk.app`; no .co.uk purchase reported. Cloudflare purchase/settings not independently inspected, no DNS changes or hosted site yet. Next owner-guided step is creating the Resend Free account for sign-in email; domain verification follows. Owner controls accounts, credentials and external setup. No app rename implemented. The previous no-domain checkpoint below is retained as history and superseded by this update.

Latest owner direction: proceed through setup one step at a time. No existing domain; owner reports seeing plates.co available at registrars. Availability, purchase price and renewal price have not been independently verified. First owner action is to review the exact domain's registration/renewal offer; no purchase has occurred. Do not advance account creation or deploy while waiting for this step.

Owner confirms a separate feature branch is active and work remains uncommitted. No hosting, email or domain accounts exist, per owner. No Git operation, external resource creation, upload, installation, deployment or hosted verification has occurred in this preparation. Existing uncommitted work is owner-controlled.

Local rehearsal results remain credited in HANDOVER.md and QA_BATCH_8.md. Hosting requires its own checks. Tonight is a target, not a verified release date.

## Proposed services and account order

| Service | Purpose | Initial proposal and limit |
| --- | --- | --- |
| Supabase | Database, Auth, private photos, Realtime | Free initially; currently 500 MB database and 1 GB file storage. Monitor photo growth. Free projects can pause after inactivity. |
| Vercel | Next.js website | Hobby if this remains eligible personal/non-commercial use. Use the assigned HTTPS address initially; custom website domain can follow. |
| Railway | One continuously running photo worker | Hobby has a $5 monthly minimum including $5 usage; extra usage is charged. Configure compute alert and hard limit before enabling the worker. |
| Resend | Sign-in codes through Supabase custom SMTP | Free tier is a candidate; currently 100 emails/day. Requires a verified domain controlled by the owner. |
| Domain registrar | Domain for authenticated email | Owner chooses/purchases the exact name and renewal price. This cost is separate from hosting. |

These are recommendations, not purchases or measured monthly cost. Retain the total £10–£20/month budget from ALPHA_RELEASE_PLAN.md; include tax, exchange rates, domain and usage. Railway's minimum does not establish the worker's monthly bill. Its hard limit stops workloads, so exceeding it also stops photo processing.

First resolve domain/email delivery and provider choices. Create accounts under owner control with MFA where available. Then create an empty alpha Supabase project in a suitable nearby region, keeping public signup disabled during schema/bootstrap preparation. Do not import local accounts, photos, QA fixtures or database snapshots.

## Website settings to prepare

- Framework: Next.js; Node 24, matching package.json. Vercel handles serving; do not use the local loopback preview as a public server.
- Install from the existing lockfile only after the owner authorises the hosted dependency installation. No package upgrades or new dependency are proposed.
- Build with the existing production workflow; the latest recorded local production check used Webpack. Confirm the hosted build mode explicitly before deployment.
- Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the exact alpha backend **before building**. Next.js embeds public variables at build time.
- Keep worker service credentials out of Vercel and out of all `NEXT_PUBLIC_` variables.
- Leave `ACCOUNT_ERASURE_ENABLED`, `APP_ADMIN_ACCOUNT_ERASURE_ENABLED`, local erasure record/checkpoint/key settings and test-account flags unset. The current detached Mac erasure worker cannot operate on Vercel. A real-user erasure operator procedure remains a release requirement, not solved by disabling the UI.
- Review source upload scope and all owner changes before any commit/push or provider connection. Git actions remain owner-run. No automatic production deployment from unfinished work.

## Schema release inventory — not an installation command

### Current result and prepared package

**Hosted structural verification — 21 October:** Owner confirms all installation-check results match33/latest20261017000100/public25/withoutRLS0/buckets5/public0/Authemptytrue. Next owner bootstrap while public signup stays closed. Auth profile trigger requires `user_metadata.display_name`; avoid generic metadata-free dashboard creation. Selected owner must be active and genuinely email verified before trusted activation; local-only helper is not a hosted tool. Owner identity choice/creation/email verification and activation remain pending.

**Hosted installation — 21 October:** Owner confirmed real33-migration push and supplied successful application output for every file followed by Finished supabase db push. Hosted schema is installed, not merely dry-run planned. No app/worker deployment or owner/tester creation yet. Next run SELECT-only `supabase/diagnostics/20261021_hosted_installation_check.sql` in hosted SQL Editor; expected33/latest20261017000100/public tables25/without-RLS0/buckets5/public buckets0/Auth emptytrue. This structural check does not establish full policies/ACLs or hosted behaviour. Signup remains off pending reviewed owner/admission bootstrap.

**Hosted link/dry-run — 21 October:** Owner confirms link completed and `db push --linked --dry-run` listed all33 expected migrations, including all7 later updates, without applying them. Exact workdir is `supabase/releases/hosted-alpha-20261021`, linked to `magftiqtsfjfzihoajor`. Next owner-reviewed operation is the same push without `--dry-run`, which installs persistent schema/buckets/policies/history. No seed inclusion requested. Actual installation is not yet confirmed; stop on any failure, do not reset/repair/replay blindly. Signup remains closed; no app/worker deployment or owner bootstrap yet.

**Hosted workspace — 21 October:** Owner reports CLI login complete and project list identifies `magftiqtsfjfzihoajor` as Plates' Project in Stockholm. Prepared `supabase/releases/hosted-alpha-20261021/` with33 fingerprint-verified migration copies, config with seed disabled and no credentials/data. Folder ignored by Git, originals/manifest remain tracked; no remote action performed by agent. Next owner link this workdir explicitly to that project, then review a dry-run before approving schema installation. Root active migrations still26 and must not be used for the hosted push. Local config closed-signup entries do not configure hosted Auth; keep dashboard signup disabled.

**Hosted empty preflight — 21 October:** Owner screenshot confirms SQL Editor role postgres/PostgreSQL17.11, Auth empty, private schema absent, public table count0 and Storage buckets empty. This is the shorter SELECT from chat; additional checks in the saved extended diagnostic remain unexecuted. No hosted migrations applied. Owner work remains uncommitted/unpublished as reported; review exact source and generated local rehearsal files before owner-controlled Git commit/push and deployment. `.gitignore` currently ignores env files (except `.env.example`) but does not explicitly exclude generated Supabase rehearsal/runtime state. Do not use blanket staging without review.

**Fresh behaviour result — 21 October:** Owner ran `node scripts/test-alpha-schema-rehearsal.mjs`; all7 suites and overall rollback-completion check passed. This covers the existing scoped SQL contract/permission suites for all7 later updates on the fresh installation. No browser, real image worker, hosted or email acceptance is implied. Next owner-run SELECT-only `supabase/diagnostics/20261021_hosted_empty_preflight.sql` in intended hosted alpha SQL Editor, review output before any hosted installation. Hosted signup remains closed. All earlier pending-rehearsal statements below are historical and superseded by these fresh installation/catalog/behaviour results.

**Fresh catalog result — 21 October:** Owner supplied PASS inventory:33 versions,9 feature relations,6 readiness-function fingerprints and table/RLS/view counts matching original local inventory; read_only=on and ROLLBACK. Full definition/ACL equivalence is not implied. Prepared `scripts/test-alpha-schema-rehearsal.mjs` for7 existing SQL suites covering all7 later updates (two photo suites, combined follow/gallery suite, Menu removal, interactions, introduction, activity). Fixed rehearsal container only; preflight requires exact33 migrations and empty Auth/profiles. Synthetic account/content/worker-journal metadata and permission/cutoff transitions are transaction-only, then rolled back. No Storage/Auth API requests, photo bytes, live worker or candidate installation. Not executed yet. Next owner-run `node scripts/test-alpha-schema-rehearsal.mjs` from project root; report fixed PASS lines or failure. Existing local and hosted systems are outside its target.

**Fresh installation result — 21 October:** Owner supplied successful startup output showing all33 migrations applied in timestamp order and health checks completed. Fresh SQL replay/startup therefore passed on the isolated local project. Resulting catalog/history inventory and permission/feature acceptance remain pending; this is not hosted deployment or full equivalence evidence. Next run the existing read-only diagnostic with Docker target `supabase_db_dinnerfolk-rehearsal-agwrjf`, leaving the original `supabase_db_plates` database untouched.

**Isolated rehearsal prepared — 21 October:** `supabase/releases/rehearsal-AGWRJf/supabase/` contains a separate config and 33 migration copies; SHA-256 comparison passed33/33. Project ID is `dinnerfolk-rehearsal-agwrjf`, ports55320–55329, PostgreSQL17, seeds/signup disabled, no credentials or hosted link. Auth/Storage/Realtime retained; Studio/analytics/edge disabled to reduce resources. Owner supplied CLI2.120.0 help supporting `--workdir`; no upgrade performed. Config/startup/ports and fresh migration replay not yet tested. Proposed owner-run command from project root:

```sh
./node_modules/.bin/supabase start --workdir /Users/roryjohnson/dev/plates/supabase/releases/rehearsal-AGWRJf
```

This creates separate local Docker resources, may download vendor images and applies all33 migrations on first startup. Share migration/health outcomes/errors only; omit printed credentials. Do not reset/delete/repair on a failure. No hosted changes or deployment are implied. Separate project identity follows [Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config).

**Packaging result — 21 October:** Owner ran the command below and shared PASS for all 33 source files, their order, unique versions and SHA-256 fingerprints. Retained package: `supabase/releases/prepared-dinnerfolk-alpha-AGWRJf`. README, manifest and migrations directory are present. Packaging is complete; fresh SQL rehearsal remains pending. Earlier execution-pending wording below is superseded by this result.

Owner-approved local inventory passed on21October2026 after separately approved Docker-socket escalation. PostgreSQL17.11 reported transaction read_only=on and completed rollback. History contains26 base migrations; the9 expected feature tables/journal relations exist, and Menu removal/photo/interactions/activity readiness definitions exist. This is evidence of installed objects, not a fresh rerun of feature acceptance or complete source/schema equivalence.

`supabase/releases/dinnerfolk-alpha-20261021.json` now records all26 base sources plus all7 later candidates in timestamp order with SHA-256 fingerprints. `scripts/prepare-alpha-schema-release.mjs` is an offline packager: validates that precise inventory/order/fingerprints, then `--prepare` creates a new uniquely named directory under supabase/releases with33 unchanged SQL files, a manifest and README. It does not edit active migrations, load .env, invoke a database, access the network, use Git, overwrite or delete files. No SQL installation is implicit. The manifest/packager are prepared; execution/validation approval is next.

Proposed owner-approved command from `/Users/roryjohnson/dev/plates`:

```sh
node scripts/prepare-alpha-schema-release.mjs --prepare
```

Expected: source-inventory PASS and the new retained package path. This does **not** verify SQL compilation, migration replay or features on a fresh database. Next prepare a precise isolated Supabase rehearsal using its real Auth/Storage/roles; do not mistake a bare PostgreSQL database or model for full Supabase compatibility. Readiness signatures and catalog counts are insufficient to establish equivalence. Existing local database history must not be repaired/reapplied casually; original seven candidates already installed.

### Prepared first check: installed local metadata

`supabase/diagnostics/20261021_release_inventory.sql` is a read-only inventory, now executed successfully as recorded above. It reads recorded migration versions and catalog metadata (expected relation existence, readiness-function signatures/fingerprints, structural table/RLS/view counts). It invokes no app functions, reads no user/content rows, prints no function bodies or credentials, and creates no fixtures. It runs in a read-only transaction with 15-second statement/3-second lock limits and ends in rollback. It is not proof of complete schema equivalence or fresh-install success.

After explicit owner permission, from `/Users/roryjohnson/dev/plates`:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/diagnostics/20261021_release_inventory.sql
```

This command targets only the named existing local Docker container; it does not discover hosted credentials or contact hosted Supabase. `-i` supplies the SQL through standard input; `-X` avoids personal psql startup commands; `ON_ERROR_STOP=1` stops on an error. Expected output is read_only=on, recorded versions, feature existence and catalog summaries followed by rollback. If Docker/container is unavailable, stop and ask the owner to start the existing local stack; do not initialise/reset/recreate it. Approval for this inventory does not approve migration application, fixtures, worker execution, schema export or a fresh rehearsal database.

Fresh-target starting sequence: all files currently in `supabase/migrations/`, sorted by timestamp, followed by these later locally activated candidates in order:

1. `supabase/candidates/20261014000100_photo_worker.sql`
2. `supabase/candidates/20261015000100_follow_notifications.sql`
3. `supabase/candidates/20261015000200_menu_photo_gallery.sql`
4. `supabase/candidates/20261015000300_menu_removal.sql`
5. `supabase/candidates/20261015000400_plate_interactions.sql`
6. `supabase/candidates/20261015000500_introduction.sql`
7. `supabase/candidates/20261017000100_activity_notifications.sql`

This inventory is not yet proven complete against the installed local schema. Before promoting it into a deployable migration chain, review the files and any applied diagnostics/hotfixes, verify duplication against existing migrations, and rehearse on a newly approved isolated database. Older candidates with matching managed migrations must not be applied twice. Candidate files contain their own transactions: do not assume a single outer rollback safely contains them. Never test fresh installation by resetting the existing local database.

Do not run seed.sql or any QA/diagnostic mutation as part of hosted setup. Do not replay the candidates against the already-activated local database. A managed migration integration strategy is still required before the owner runs a hosted schema command.

## Auth, email and owner bootstrap

**Owner link verification — 21 October:** Owner clicked emailed confirmation link, then reported hosted SELECT email_confirmed=true and has_signed_in=true. Later resend no-email is consistent with confirmed-account no-op; do not rerun the confirmation helper. Code-template discrepancy remains unresolved: saved custom template persisted, earlier messages showed default links; Auth logging only enabled afterwards. Prepared guarded owner-run activation SQL template at `supabase/bootstrap/activate_hosted_alpha_owner.sql`; requires the exact verified active Dinnerfolk Admin profile and only1 Auth account, calls existing trusted activation with transaction-local role claim. Not executed yet; keep dashboard signup disabled and do not claim OTP emails or helper session-signout verified.

**Owner-confirmation correction:** Initial live existing-account OTP request failed signup_disabled for the unconfirmed admin-created user. No verification/owner grant succeeded. Helper now uses supported `auth.resend({type:'signup',email})` confirmation route, retaining real code verification and helper-session signout. Revised offline suite also checks installed SDK request sequence through fake transport; rerun pending. Confirm signup email template must show {{ .Token }} before live resend; Magic link template alone is insufficient. Keep signup closed and do not rerun account creation or auto-confirm as a workaround. Source reference: https://github.com/supabase/auth/blob/master/internal/api/resend.go .

Owner reports live creation helper PASS: single Dinnerfolk Admin account exists, email unconfirmed. Do not repeat creation. Prepared `scripts/verify-hosted-alpha-owner.mjs` for real email-code verification using publishable key, existing-account-only OTP request, hidden code and temporary-session signout; no credentials/session persisted or owner grant. Offline checks prepared in `scripts/test-hosted-alpha-owner-verification.mjs`, not executed yet. Next run that offline check, then review live send/verification command. Signup stays closed. First real email delivery/verification remains untested until live helper succeeds.

Owner screenshot confirms dashboard Create user form lacks metadata, so it is unsuitable for this trigger. Prepared `scripts/create-hosted-alpha-owner.mjs` for supported Admin API creation with required display_name, selected email entered privately, email_confirm=false, random undisclosed password and no automatic retry. Fixed hosted origin; refuses nonempty Auth; key prompt hidden and no credential/session persistence. No email send/owner grant/signup-setting change. Run offline `node scripts/test-hosted-alpha-owner.mjs` first; prepared but not yet executed. Actual helper execution needs owner-run review and privately entered backend key; real inbox verification and separate trusted activation follow. Do not submit metadata-free dashboard creation or auto-confirm email to bypass verification.

Supabase's default email service refuses normal non-team recipients and currently permits only two messages/hour. Custom SMTP is required before inviting testers.

Resend configuration, after owner-controlled domain verification: host `smtp.resend.com`, port `465` (TLS), username `resend`, password the provider key entered privately in Supabase's SMTP settings. Choose a sender on the verified domain. Keep email tracking disabled for authentication messages. Confirm an email template displays the numeric code expected by the app, rather than relying solely on a magic link. Review OTP length, expiry and both providers' rate limits against the current form before opening signup.

Set Supabase's Site URL to the final HTTPS alpha app address and allow only required exact redirect destinations. Local supabase/config.toml is not proof of hosted settings. Verify exposed schemas, grants, private buckets and Realtime configuration separately.

Admission defaults disabled in the migration: public Auth signup must remain closed until a reviewed owner-bootstrap procedure is ready. The activation RPC needs an existing verified active owner profile; the local bootstrap tool explicitly targets local services and must not be reused blindly for hosting. Prepare exact steps to create/verify only the owner, activate admission for that identity and test unlisted signup denial before enabling general email signup. Do not create an uncontrolled open-signup window. Allowlisted testers are added only after hosted checks; adding an address does not send an invitation.

## Dedicated worker configuration

`railway.photo-worker.json` is a reviewable configuration for the proposed worker service. Select that custom config path explicitly in Railway; it is deliberately not a default root railway.json. The service uses Railpack dependency installation and a syntax-only build command to avoid building the website, then starts the dedicated worker directly. Native dependency compatibility and the provider's actual install/build behaviour still need Linux verification.

Set these privately on the worker service only:

| Variable | Required value |
| --- | --- |
| `PHOTO_WORKER_ENABLED` | Leave unset during preparation; `true` only when approved to start |
| `PHOTO_WORKER_ENVIRONMENT` | `hosted` |
| `PHOTO_WORKER_SUPABASE_URL` | Exact `https://PROJECT_REF.supabase.co` origin |
| `PHOTO_WORKER_EXPECTED_ORIGIN` | The same exact approved origin |
| `PHOTO_WORKER_SERVICE_KEY` | Backend service credential; secret, never public |

`PROJECT_REF` is an obvious placeholder for the alpha project's identifier. Do not put real keys in this file or chat. The current worker accepts this hosted Supabase URL shape only.

Use one replica in one region, disable sleeping, do not expose a public HTTP endpoint and do not configure an HTTP healthcheck for this background process. Set resource limits and compute spending controls before enabling it. Verify startup/readiness and recurring health events in logs; a running container alone does not prove photo processing works.

The configuration requests 120 seconds for graceful shutdown and disables automatic crash restart. Recovery deliberately requires a human to confirm the exact previous process is stopped and requests have drained. Even zero configured overlap is not a guarantee of sequential deployment: stop/drain the old worker and confirm `drained:true` before starting its replacement. Do not enable recovery flags permanently, scale replicas, blindly redeploy a blocked run or start the legacy media worker. Forced termination can still require exact-run investigation/recovery. Hosted shutdown and native decoding remain untested.

## Checks before sending the alpha link

1. Fresh isolated schema installation and required permission/readiness checks pass; no copied local users or fixtures. Record the exact reviewed source version and owner-run Git/deployment steps.
2. Hosted owner setup and admission enforcement work, including denial through direct API signup. An expressly authorised synthetic tester receives a real code and signs in/out; wrong/expired code and return login work.
3. Two authorised hosted test accounts pass the core Plate/Table/Menu journey, Realtime updates, private/outsider/revoked access and private image signing. Verify deployed pages on an actual phone.
4. Dedicated worker processes agreed JPEG/PNG/HEIC uploads and Menu previews. Confirm failed-photo draft recovery, URL expiry, health logs, controlled shutdown/restart and operator recovery. Agree synthetic fixture/upload scope before creating hosted content.
5. Protect a separate encrypted database **and Storage** backup, with independent custody and a documented restore/erasure-replay process. A database-only export does not back up image bytes. Existing local restore drills are evidence for the local procedure only.
6. Resolve the hosted erasure/operator process and tell testers accurately what alpha retention/support means. Do not promise an instant photo recall or a deletion workflow that has not been tested.
7. Check all unresolved release gates here, then allow the first small group. Owner sends invitations; no messages are authorised by this runbook.

The older worker acceptance plan proposes 24-hour idle and 72-hour usage observation. Those windows cannot finish tonight. Any decision to begin a smaller supervised alpha before completing those observations must explicitly retain those limits; do not mark the long-window checks passed.

## Verification of this preparation

Owner approved and agent ran `npm run lint`, `node --check scripts/photo-worker.mjs`, `node scripts/test-photo-worker-runtime.mjs` and `node scripts/test-local-photo-worker.mjs` from the project root; all passed on 21 October 2026. Runtime tests use in-memory failure/recovery models and real offline synthetic decoding; launcher tests are offline. No fresh production build/typecheck, isolated schema rehearsal, provider config validation or hosted build, SQL install, SMTP delivery or live worker execution has occurred. New Railway configuration is prepared but has not been exercised by Railway.

## Official references checked 21 October 2026

- [Supabase SMTP restrictions and configuration](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase pricing](https://supabase.com/pricing)
- [Vercel Hobby eligibility](https://vercel.com/docs/plans/hobby)
- [Railway billing](https://docs.railway.com/pricing/understanding-your-bill)
- [Railway compute spending limits](https://docs.railway.com/pricing/cost-control)
- [Railway config fields](https://docs.railway.com/config-as-code/reference)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend SMTP](https://resend.com/docs/send-with-smtp)
- [Resend pricing](https://resend.com/pricing)
- Installed Next.js deployment/environment-variable guides in node_modules/next/dist/docs were read before preparation.
