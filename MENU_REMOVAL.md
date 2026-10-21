# Reversible Menu removal

Prepared 2026-10-15. **Owner-approved candidate installed locally; installed-schema rollback tests and requested owner browser checks passed.** Owner confirmed saved Plate/Request removal, Undo, refresh/Removed-items Restore and restored content/photos all pass. Candidate file remains outside managed migrations. No physical removal of records/files, cleanup, dependencies, Git or hosted work. App used for review; photo worker state uninspected.

## Behaviour

- Each saved item has Remove from Menu with confirmation. After removal an Undo notice appears, and Removed items offers Restore to Menu. Search stays within the current active/removed view; filtering happens before the existing list/search limits.
- Removed copies retain their original saved date, text/link snapshot, photo gallery and source links. Restore reuses that copy rather than fetching changed originals or creating new preview jobs. Source-page saved controls detect removal and offer restoration. Existing save RPCs keep their original idempotent behaviour and do not silently restore; the new UI invokes the explicit restore operation.
- Original Plates, Table discussions and other people's saves remain unchanged. A restored Plate snapshot remains readable after ordinary author privacy/follower changes; fresh original access is still separately checked. Requests remain live references: restoring after Table access is lost shows the existing unavailable placeholder, not private discussion content.
- Plate account erasure overrides removal/restore. An erased saved snapshot cannot be restored, and a disabled saver cannot change anything. Request references after source erasure never expose erased question/context. Retained photos remain covered by existing erasure tracking. Removal is organisation, not a promise of data erasure or storage cleanup.
- Version checks reject stale browser changes; identical retries are idempotent. Loading/error/busy and confirmation states are included. No permanent delete action or automatic removal policy.

## Implementation

Candidate `supabase/candidates/20261015000300_menu_removal.sql` adds `removed_at` and `menu_version` to both saved-item tables, plus `updated_at` on Request saves so their existing update guard can run. Existing rows start active/version zero. It appends removal metadata to the security-invoker Request context view, adds owner-only state/change RPCs and active/removed search, and keeps legacy Menu search scoped to active items. No direct client UPDATE/DELETE grants, immutable snapshot changes or worker changes.

App code checks readiness before selecting new columns or displaying removal controls, preserving pre-activation behaviour. `menu-item-actions.tsx` handles remove/restore/Undo; Menu has active/removed views and controls; saved source controls can restore the existing copy. Live account-update signalling refreshes other visible sessions.

## Verification

Owner approved and agent ran `npm run lint`, `npm run typecheck`, `node --check scripts/test-menu-removal.mjs`, `node scripts/test-menu-removal.mjs` and `npm run build -- --webpack`; all passed, including final compilation/type checking/page generation/build tracing. Docker test required separately approved escalation. Owner confirmed app preview stopped and photo worker stopped/drained=true before DB checks/build.

Rollback fixture scope: candidate schema, three synthetic Auth/profile/username accounts, one Table/Request, one two-photo Plate, two source intent/assets, three preview jobs/assets and four saves (two Plate/two Request). Authenticated-role assertions cover owner isolation, no direct update/anonymous/worker access, removal/Undo/retry/version conflicts, active/removed search, independent saves and original snapshot/date/photo retention. Table membership revocation and private-account transition verify restored copies do not regain original access. Synthetic source/saver recorded-erasure cutoffs verify no snapshot resurrection, no disabled-saver change and all derived objects tracked. Structurally valid fixture receipts do not test independent ledger signatures.

All fixture/candidate changes rolled back. No Storage API/image bytes, worker ownership/takeover, Auth deletion or actual file/object removal. This is metadata contract testing, not real concurrent requests, browser accessibility or hosted/cache acceptance.

## Local activation — approved and completed

Owner explicitly approved the preflight, single-candidate installation and same-scope installed-schema checks below. Preflight passed, installation COMMIT succeeded and installed fixture tests passed with all synthetic data rolled back. Docker access required separately approved escalation. Existing saves remain active/version zero; no real saved-item removal or cleanup performed. Do not replay candidate installation or its absence preflight. Commands below are retained as an execution record from `/Users/roryjohnson/dev/plates`, with app/worker last confirmed stopped.

1. Read-only preflight. Refuses partial/already-installed removal columns, missing gallery prerequisite or active/unfinished photo work. Process shutdown also requires owner confirmation.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/diagnostics/20261015_menu_removal_preflight.sql
```

2. If preflight passes, install only the removal candidate. This commits schema/functions and default active/version-zero metadata, without removing any existing item. Do not rerun earlier candidates or push all migrations.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/candidates/20261015000300_menu_removal.sql
```

3. Verify installed schema with the same rollback-only fixture scope (skips candidate creation):

```sh
node scripts/test-menu-removal.mjs --applied
```

No schema removal, real-item state changes or cleanup in activation/testing. Candidate remains outside managed migrations; owner-controlled migration/release integration remains future work. Installation failure must be investigated, not bypassed by weakening guards.

## Browser acceptance after approved activation

Owner starts built preview with `npm run start` and dedicated photo worker with `npm run photo:worker` in separate project terminals as needed. Removal/restore does not require photo processing; new uploads/saves still do.

Using existing owner-selected test copies, remove a saved Plate and Request, confirm disappearance from normal list/search, Undo, remove again, reload Removed items and restore. These actions update only the selected account's saved-item organisation; keep both originals and all photos. Check multi-photo order/content/date stay unchanged, no duplicate preview processing, source-page Restore, refresh persistence and keyboard confirmation/Undo controls. Confirm another account's saves/originals remain unchanged. Check private-original/Table access revocation and stale controls across two sessions. No real account erasure or permanent deletion is authorised for browser acceptance.
