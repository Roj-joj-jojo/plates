# Local privacy and security review

Reviewed 2026-10-10 against the local prototype. This is a focused code, schema and local permission review, not a penetration test or a review of a hosted deployment.

## Confirmed findings

| Finding | Current state | Action |
| --- | --- | --- |
| Any signed-in account could enumerate all active profile names, IDs and timestamps. The original profile RLS policy checked only that a caller was active. It did not expose Auth email addresses. | **Fixed locally** by `20261009000610_profile_visibility.sql`; the owner approved application. A caller now sees their own profile, authors of available Plates, and current peers in shared available Tables. Applied-schema SQL tests passed unrelated-account and anonymous denial. | Retest with real multi-member browser sessions when invitations exist. |
| Nine newer public media tables retained broad default table grants to `anon`, `authenticated` and `service_role`. RLS blocked anonymous rows, but authenticated callers could directly request columns outside the intended table API, including paths and processing lineage, on rows they were otherwise allowed to see. Eligible viewers can already obtain some paths through guarded image-location functions; this was a privilege-boundary gap, not proof of cross-account photo access. | **Fixed locally** with owner-approved `20261010000100_media_grants.sql`. Only required column reads and worker writes remain. | Applied-schema permission test and Plate/Menu-preview/Table-photo SQL suites passed. A fresh real HTTP photo flow was not run after this grant-only change. |
| `private.validate_plate_images(uuid[],uuid,uuid)` was executable by `authenticated` because its function grant was not explicitly revoked. The private schema is not exposed through the normal public API, and this helper does not write records, so this was a narrow privilege gap rather than confirmed account compromise. | Its authenticated execute grant was removed in the same local migration. | Applied-schema privilege check passed. |
| Self-service email sign-up is enabled locally. Any person who can reach the app and receive an email code can create an account; every active account may read the signed-in Feed. | Intentional prototype setting, **not suitable for a friends-only deployed trial without an invitation/admission gate**. Local app and Supabase services are loopback-bound per the working ledger. | Add the admission design before public hosting or invitations. Do not rely on the UI's “Create account” label as an access control. |
| Plate, Table and Menu preview signed photo URLs last 3,600 seconds. Previously issued URLs can outlive a membership/access change until expiry unless the object is removed. The media worker has no cleanup path and can leave an object if upload succeeds but its database completion fails. | Unresolved erasure/lifecycle gap. All five buckets are private, and their current Storage policies require an authenticated eligible reader for new signs/reads. | Implement prompt object deletion, reconciliation and old-URL checks as part of erasure; consider shorter URL lifetimes before wider use. |

## Checks performed

- Inspected the applied database permissions for all public/private functions and public tables. All application tables have RLS enabled. The public views are configured `security_invoker=true`. The five media buckets have `public=false`; their Storage policies allow authenticated staged inserts or eligible photo reads, with no anonymous read policy.
- Reviewed the app's Supabase clients, session proxy, public actions, link rendering and image processing boundaries. The browser uses the public key; the service-role key is fetched only by the standalone local worker, which checks the API URL is loopback and matches the local Supabase instance. Content links are database-validated as HTTP(S), and React renders text without raw HTML.
- The media-grants migration passed its own permission test and the existing Plate-photo, Menu-preview and Table-photo SQL suites under rollback before application. After local application, all four suites passed again with rollback. The older anonymous-read assertions were strengthened to expect permission denial; the Menu-preview test now derives its fixture path without granting authenticated access to the hidden `object_path` column.
- `npm audit --offline --omit=dev` reported zero known production dependency advisories from local cache. This is not a fresh online advisory check.

## Limits and next review

No exploit attempt was made against a remote service. The test suites do not prove the absence of all bugs. Before any hosted trial, test real multi-account Table access and departure, admission controls, OTP abuse controls, photo URL expiry/revocation, worker cleanup, and backup/log retention. Account erasure remains unimplemented; see `PRIVACY_ERASURE_PLAN.md`.


## 2026-10-10 clarification after local erasure verification

The earlier unimplemented-erasure and no-worker-cleanup findings above describe the initial audit. Approved disposable account-erasure SQL/HTTP/browser checks have since passed locally, including old-URL denial and peer preservation; general erasure remains disabled. Scoped abandoned-upload recovery now has a local operator candidate with simulated/static checks only. Hosted retention, automatic recovery and deletion-index/restore-gate implementation remain release gates. See `ACCOUNT_ERASURE_RECOVERY.md`, `RETENTION_RESTORE_PLAN.md` and the latest `HANDOVER.md` notes. No hosted audit or deployed security guarantee is implied.
