# Follow notifications, saved photo galleries and unavailable pages

Prepared 2026-10-15. **Both SQL candidates installed locally with explicit owner approval; installed-schema rollback checks passed.** Candidate files remain outside managed migrations. Owner confirmed a non-default branch. No Git/dependency/deletion/hosted actions. Keep the legacy media worker stopped. App preview and photo-only worker have not yet been restarted after activation.

## Resulting behaviour

- `src/app/not-found.tsx` supplies an oat-background unavailable page with Feed/Table navigation. Unknown and inaccessible content receive the same wording; no private content or existence distinction. Avoids the default 404's operating-system dark/light colours.
- Bell/Notifications include incoming private-account follow requests with existing Accept/Decline controls, plus new-follower alerts and existing mentions. Pending requests remain actionable/unread in the badge until resolved. Informational follower alerts can be marked read. Approval resolves the request without notifying the author about their own approval action. Cancellation, decline and unfollow retire the matching event. New notifications apply to new follow transitions; installation also surfaces already-pending requests, without manufacturing historical new-follower alerts. No email/push, likes or other new event types.
- New photo Plate saves prepare an ordered private preview for every attached photo (up to six), wait for all previews, then atomically capture gallery links with the existing body/link/attribution snapshot. A partial gallery cannot be saved. Images use the existing 640-pixel preview limit, bucket, worker journal and erasure guards; each image counts against existing preview-job quotas. Retry reuses a complete pending/processing/ready batch; a failed batch can generate a new quota-bounded batch. Older one-photo Menu saves remain one-photo snapshots. No historical backfill or fetching revoked originals.
- Galleries remain saver-only and survive ordinary source privacy/unpublish/follower changes. Account erasure overrides retention: existing erasure enumerates every derived asset by saver/source and marks saved copies unavailable. Extra gallery links contain only existing save/asset IDs and positions. No new object deletion mechanism.

## Checks and evidence

Owner approved and agent ran:

```sh
npm run lint
```

```sh
npm run typecheck
```

Both passed. Owner then confirmed photo worker stopped with drained=true and approved runner syntax and rollback-only local SQL fixture checks:

```sh
node --check scripts/test-social-menu-updates.mjs
```

```sh
node scripts/test-social-menu-updates.mjs
```

Both passed; Docker access required owner-approved escalation. Single transaction temporarily installs both candidates, includes transaction-only notifications for current pending requests, creates three synthetic Auth/profile/username accounts, one six-photo Plate, six source-image intent/asset records, seven preview jobs/assets and two Menu saves. Fixture saver/source erasure cutoffs use structurally valid synthetic receipts, not independently signed deletion records. All changes roll back. No worker ownership acquisition, Storage API/image bytes, Auth deletion or cleanup.

Assertions exercise authenticated-role recipient isolation/read marking, no direct notification/gallery-table access, worker/anonymous refusal, idempotent follows and gallery requests, decline/accept/stale request conflicts, six-image order, partial-save refusal, saver-only signing guard, follower revocation, older single-preview compatibility and saver/source cutoff with all derived paths tracked. Metadata test setup marks synthetic jobs ready directly; this is not a live worker/Storage/gallery/browser integration test or concurrent race test.

Owner separately stopped the app preview and approved `npm run build -- --webpack`; it passed compilation, TypeScript, page generation and build tracing, including the new `/_not-found` route. Real browser/display/live gallery processing, cache expiry and hosted tests remain separate.

## Local activation — approved and completed

Owner explicitly approved the following preflight, both persistent candidate installations and installed-schema checks. Preflight passed; both installations COMMIT succeeded. Pending-request capture inserted zero rows. Installed-schema fixture suite passed and rolled back all synthetic data/cutoffs. Sandbox Docker access required separately approved escalation for these commands. No code changes were required, no Storage calls or cleanup ran. Do not replay the candidate installations or absence preflight against the now-installed schema.

The commands below are retained as an execution record and explanation of scope. All ran from `/Users/roryjohnson/dev/plates` with app/worker last confirmed stopped. Preflight refused installed candidates or active/unfinished photo work; it did not independently establish process shutdown.

1. Read-only preflight:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/diagnostics/20261015_social_menu_preflight.sql
```

2. Install follow notifications only if preflight passed:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/candidates/20261015000100_follow_notifications.sql
```

Commits one private notification table, trigger and recipient-only RPCs; copies currently pending follow requests into notification records. Existing relationship permissions/actions unchanged. Existing approved follows do not generate historical alerts.

3. Install gallery support only after the previous command succeeds:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/candidates/20261015000200_menu_photo_gallery.sql
```

Commits two private linking tables, gallery request/read RPCs, a save-time completeness trigger and saver-only Storage helper extension. Existing single-photo preview APIs remain. Creates no preview jobs/objects for existing saves. Worker code/schema unchanged. Each candidate is independently transactional; if the second fails, stop/report the partial installation rather than reinstalling the first. Do not remove schema or widen grants to fix a failure.

4. Installed-schema verification, same owner-approved rollback fixture scope:

```sh
node scripts/test-social-menu-updates.mjs --applied
```

This skips candidate creation, uses existing installed functions and rolls back its fixtures. No migration push or automatic candidate installation. Candidates must be incorporated into the owner-controlled migration/release process before a fresh environment can reproduce the schema; this document does not authorise that Git/release work.

## Browser acceptance after approved activation

Owner restarts built app with `npm run start` and photo-only worker with `npm run photo:worker` in separate project terminals. Normal worker startup processes all eligible local photo queues; no recovery flags for the old run.

- Reload inaccessible Plate/Table links: same readable unavailable page, usable Feed/Table links, no restricted text/photos. Check light/dark system preference and mobile/keyboard presentation.
- Open account follows: recipient's bell increments, new follower appears, profile link resolves, mark-read clears informational unread count. Repeat follow/reload must not duplicate event.
- Private request: recipient sees bell and Accept/Decline without searching People. Cancelled/resolved request disappears; stale controls fail safely; acceptance grants only expected Plate access. Check between two sessions and badge live refresh. An existing pending request at installation should appear. Mentions remain functional. Older already-approved followers should not create new alerts.
- Publish a NEW multi-photo Plate using separately agreed test images, save from the second account and verify all previews/enlarged viewer/Previous/Next order and stable retry. Worker remains required. Saving adds one preview job/object per image, retained until separately approved cleanup. Existing saves intentionally stay unchanged.
- Revoke original access and verify fresh original denial plus all saved previews retained; third account cannot access another person's Menu gallery. Fresh signing should follow saver availability. Account-erasure fixture metadata was tested; real account deletion/cleanup is not authorised for browser acceptance.

No hosting, fixture transmission, account deletion, old-save backfill or new notification types are authorised by the implementation alone.
