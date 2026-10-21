# User and Table pictures — local implementation

## Status

Enabled locally on 2026-10-13 after explicit owner approval. Migration `supabase/migrations/20261013000100_pictures.sql` was confirmed as the only pending change and applied. The retained candidate is `supabase/candidates/20261013000100_pictures.sql`. Candidate and installed rollback suites passed. The website and media worker need restarting before browser review.

## Behaviour

- Account: choose, preview, save, replace or confirm removal of your own picture.
- Table member management: the same controls for current Table Admins only.
- Pictures appear on profiles, Feed authors, Plate details, Table list/header, conversation authors and member lists/panels. Initials remain when absent or unavailable.
- JPEG, PNG, WebP and HEIC uploads reuse the existing private media worker, byte/pixel limits, WebP conversion and metadata stripping. Display uses a centred crop; no manual crop editor is included.
- User pictures follow existing profile visibility (self, visible Plate author, or current Table peer). Table pictures require current membership. Five-minute signed URLs; a previously issued URL can remain usable until expiry if the object has not yet been cleaned up.
- Backend checks ownership/Admin rights again on save. An expected version prevents overwriting changes made elsewhere. Retrying an accepted save does not repeat the version change.
- Replacement/removal stops fresh reads of the old picture and queues only its processed object and matching staged source. The media worker retries failures. Retired picture assets cannot be reused on a Plate.
- Account cutoff clears the user picture and Table pictures uploaded by that user. Existing account erasure already covers their media assets. The new cleanup gate prevents identity completion while retired picture cleanup is pending. Closed Tables clear their picture too.

## Database scope

The candidate adds four private tables, picture RPCs, a Storage read policy and lifecycle/attachment triggers. It uses existing private `staged-assets`/`plate-media` and processing; no new dependency or bucket. No schema objects are dropped and no existing picture or content records are migrated/deleted by applying it. It preserves existing upload limits, Table/Plate media flows and erasure recording safeguards.

## Verification

- Lint and typecheck passed after fixing a Storage error-type check.
- Worker and SQL runner parsed successfully with the installed TypeScript parser, without starting them.
- Candidate rollback SQL suite passed: anonymous/direct-write/worker-edit denial, own editing, ordinary member/Admin access, profile/Table privacy, replacement/removal, accepted retry, stale version conflict, retired asset reuse refusal, removed-member denial, Table closure, cleanup retry and recorded fixture cutoff/identity gate.
- Initial sandbox test could not access Docker. Approved Docker retry exposed an incorrect fixture insertion into the recorded-erasure job table; the fixture was corrected to use the recorded-erasure flow, then the suite passed.
- Three synthetic accounts, one Table and four processed-media metadata fixtures were rolled back. No Storage object was uploaded or deleted, and no media/erasure worker ran.
- No full build, live photo processing, signed-URL expiry, browser/device interaction or simultaneous multi-session race test is claimed.

## Activation record and browser review

1. Owner approved copying the candidate to `supabase/migrations/20261013000100_pictures.sql`; copied without overwriting.
2. `./node_modules/.bin/supabase migration list --local` confirmed only this migration was pending.
3. `./node_modules/.bin/supabase db push --local` applied only that migration.
4. `node scripts/test-pictures.mjs --applied` passed (synthetic fixtures rolled back).
5. Owner rebuilds/restarts the website and restarts the existing media worker. Never build into an active production preview’s `.next` directory.
6. Browser upload/removal tests need separately approved disposable pictures/targets. Check own Account, an Admin and member session, private Table visibility, replacement conflict, failure/retry and fallback. No agent should run a cleanup worker against unapproved objects.

No Git, publication or deployment is part of this work.
