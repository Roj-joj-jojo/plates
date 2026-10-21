# Photo worker preparation — 2026-10-14

## Local startup update — 2026-10-15

`npm run photo:worker` now launches the dedicated replacement locally. It loads the app URL from `.env.local`, validates a loopback destination, obtains local Supabase status/service credentials in memory and requires an exact origin match before importing the worker. Credentials and raw CLI errors are not printed or saved. No new dependency or environment-file change. The original `media:worker` command still starts the legacy implementation and must not be used against the installed photo-worker schema.

From `/Users/roryjohnson/dev/plates`, ordinary startup after a clean drained shutdown:

```sh
npm run photo:worker
```

This processes all eligible local Plate/Table uploads and Menu previews, not just a browser test upload. It does not run account erasure or cleanup. Keep the terminal open. Ctrl+C requests a graceful stop; wait for `photo_worker_stopped` with `drained:true`. Startup refuses retained ownership; do not automatically add recovery flags.

Owner's first replacement launch used an agent-supplied inline command with `--input-type=module`. Decoder threads inherited the incompatible flag and the Table job blocked at decode. Offline reproduction confirmed ERR_INPUT_TYPE_NOT_ALLOWED. Owner's read-only DB check confirmed active run `fa217fa4-5de8-4ed9-ac51-c4f20bc991b9`, one Table journal row blocked/decode and no prepared output. The process reported stopped/drained=false; ownership is retained. Source download completed before decoding and this path had not reached output preparation/upload. No independent live DB inspection by agent.

Prepared one-time operator recovery, only with that process exited, its requests finished and no other worker started since the check:

```sh
npm run photo:worker -- --recover-stopped-run fa217fa4-5de8-4ed9-ac51-c4f20bc991b9 --writer-stopped --requests-drained
```

The first `--` forwards the remaining arguments through npm. This explicitly transfers ownership and retries unfinished work; normal local queue processing continues afterward. It does not reset rows, delete objects or reinstall schema. Do not use this run identifier for later failures. Expected start/completion events still need owner confirmation; stop for investigation if blocked/refused again. No live recovery has been reported yet.

Owner-approved syntax, focused two-file ESLint, `test-local-photo-worker.mjs` and existing `test-photo-worker-runtime.mjs` all passed. New offline checks cover local-origin/key/recovery validation and real in-memory PNG decoding under normal file launch. Existing suite covers all job kinds, uncertainty, retries, decoder rejection and shutdown. No credential discovery, DB/Storage access or live worker start occurred in those tests. Browser Table/Menu/access tests remain pending.

Status: candidate installed in the local database with explicit owner approval; restricted Storage/DB pipeline passed after approved guarded continuation. Not deployed. Owner confirmed `prototype-foundation`. Existing general media worker, environment files and package commands are unchanged, but its legacy claim path is blocked by the installed candidate. Original worker remains stopped; continuous replacement worker has not been started. See PHOTO_WORKER_E2E.md.

## What is prepared

- Dedicated `scripts/photo-worker.mjs` processes Plate uploads, Table uploads and Menu previews sequentially. It does not run account erasure or picture cleanup.
- One queue RPC per idle cycle, with an idle delay increasing to five seconds; active cycles use a 1.5-second delay. This reduces polling, but actual idle resource use remains unmeasured.
- Aggregate health logs report memory, CPU and queue counts without photo contents, account identifiers or credentials.
- A staged SQL candidate records output identity and hash before uploading. Uploads refuse overwrites; recovery verifies existing bytes before completing a job.
- Startup requires explicit environment, expected backend origin, service credential and enabled flag. It does not load the app's local environment file or discover credentials.

## Important limits

The SQL candidate is in `supabase/candidates/20261014000100_photo_worker.sql`, outside automatic migrations, and was explicitly installed locally on 2026-10-14 after a clear preflight. Its claim guard deliberately prevents legacy pending-to-processing claims. Do not reinstall it or restart the original worker for ordinary photo processing. No continuous replacement worker start has been approved.

Interrupted runs require the exact prior run identifier and confirmation that the previous process has stopped and its outstanding requests have drained. This is manual recovery, not unattended recovery within two minutes. Database ownership alone cannot fence an old Storage request.

Uncertain writes, decoder timeouts/crashes and failures involving prepared output stop the worker and preserve the job for investigation. New local code terminally rejects an explicit decoder failure reply only before preparation, with a standard message and no output attempt. It then continues with other jobs. The database rejects attempts to use this path on prepared/uncertain output; rejected jobs remain terminal across retries/restarts. **Focused lint, expanded offline tests, ownership SQL and eleven-job flow SQL all passed on 2026-10-14.** Database test changes rolled back. Full erasure lifecycle, saver-only erasure, concurrent transactions, real Storage verification and handling other legacy processing jobs still need review. This candidate is not ready for a friends alpha or hosted trial yet.

## Verification

Owner approved and agent ran these local checks; all passed:

```sh
node --check scripts/photo-worker.mjs
node scripts/test-photo-worker-runtime.mjs
./node_modules/.bin/eslint scripts/photo-worker.mjs scripts/photo-worker-runtime.mjs scripts/photo-worker-backend.mjs scripts/photo-worker-config.mjs scripts/test-photo-worker-runtime.mjs
```

Offline tests cover idle polling, sequential processing, all three job types, immutable outputs, uncertain upload/completion acknowledgements, corrupt output refusal, missing source retry, overlap prevention, shutdown draining and the existing decoder/preview processor. Recovery in these tests uses an in-memory backend model, not PostgreSQL or hosted Storage.

**Latest result: ownership SQL suite passed and rolled back.** Owner confirmed the original worker stopped/drained and explicitly approved exact-four-job failure dry-run plus guarded commit. Both passed; only those four upload state/error/update-time changes committed. Rerunning `scripts/test-photo-worker-sql.mjs` then passed access restrictions, exclusive ownership, recovery confirmation gates, old-run refusal and preservation of synthetic journal identity. Candidate schema and test metadata rolled back; the new worker remains inactive. Original worker remains stopped as last confirmed by owner.

Earlier attempts found a corrected CASE-expression syntax error and then refused existing processing jobs. Runner syntax and focused lint passed; local Docker access was separately approved. The existing-job refusal diagnostic is included in the now-passing suite. No live photo completion, Storage or erasure tests have run.

The runner wraps candidate creation and metadata-only ownership tests in one local PostgreSQL transaction and rolls it back. It creates no accounts or photos, does not process real queues, and refuses existing processing jobs. Its intended scope checks SQL compilation, service access, exclusive ownership, required recovery confirmations and preservation of a synthetic journal identity. It does not test real photo completion, Storage or erasure.

The approved test command, from the project root, is:

```sh
node scripts/test-photo-worker-sql.mjs
```

It uses the existing Docker database container `supabase_db_plates`. Candidate schema changes and synthetic journal records are transaction-only; concurrent schema operations may briefly wait, bounded by a three-second lock timeout. Existing workers should be stopped before testing. No activation, live worker startup, Storage upload/removal or hosted access is included.

## Order of remaining work

1. Completed: owner stopped/drained original worker; approved exact-four-job failure dry-run and guarded commit both passed. Records/files retained. These four uploads now report failed/re-upload; this did not restore photos. Ownership suite subsequently passed in a rollback-only transaction. Keep this recovery script as a record, not a routine command: its original processing/timestamp guards will now refuse the changed jobs.
2. Completed: separately approved runner syntax, focused lint and rollback-only fixture suite all passed. This verifies metadata completion/retry and fixture-author erasure safeguards, not physical Storage or the full erasure lifecycle. See scope below.
3. Completed: decoder-rejection handling passed expanded offline/SQL assertions. Recovery remains deliberately manual for interrupted writes; see runbook below. Restricted end-to-end driver and offline scope tests are now prepared, not run. Review PHOTO_WORKER_E2E.md and approve offline checks before persistent activation/upload scope.
4. Only then approve a local end-to-end trial and an isolated hosted Linux trial, including representative HEIC photos.
5. Measure idle behaviour, bursts, upload-to-display time and actual cost before choosing a capacity or subscription. Keep the total £10–£20 monthly ceiling; it is not a spending target.

### Executed, owner-approved stalled-job recovery commands

From the project root, only after owner confirms original worker has stopped and its requests have drained:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v writer_stopped=true -v apply=false -f - < supabase/diagnostics/20261014_fail_stalled_plate_uploads.sql
```

Result: four targeted jobs became failed inside the test transaction, checks passed, then rollback. A temporary target-list table existed only for that connection.

After explicit owner authorisation and the successful dry run, agent ran:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v writer_stopped=true -v apply=true -f - < supabase/diagnostics/20261014_fail_stalled_plate_uploads.sql
```

This commits state, error message and update-time changes for precisely the four reviewed job identifiers. The UI will treat those uploads as failed and ask for re-upload. It does not restore missing photos, remove files/records, reset jobs to pending, activate the candidate or change any other uploads. Changed conditions cause refusal/rollback. Restoring the old processing state would require another expressly approved change; the proposal does not automatically undo committed changes.

## Prepared next test: completion and erasure contracts

**Latest expanded suite passed and rolled back:** fixture suite includes three extra unprepared rejection jobs (one each of Plate/Table/preview), bringing scope to eleven jobs: six Plate, two Table and three previews. It verified repeated rejection, refusal to reject prepared output, preservation after block/restart and clean shutdown with rejected jobs. The two synthetic accounts, Table/Plate/Menu save and fixture-author erasure scope remain the same. The prior eight-job run is recorded below as earlier verification.

**Owner approved and agent ran all three checks; all passed on 2026-10-14.** Database result: `PASS photo worker flows (fixture DB metadata only; rolled back)`. All schema and fixture changes used one local transaction ending in rollback. Created two synthetic Auth/profile records, one Table with those two members, one photo Plate, one Menu save, five Plate upload intents, one Table upload intent and two preview jobs. Existing admission setting was disabled only within that transaction to create fixtures and restored by rollback. Only fixture records were claimed/completed or subjected to erasure initiation; no existing upload changed. Existing processing jobs cause refusal.

Coverage: Plate/Table/preview output namespaces and one asset after repeated completion; pending source permission and rejection after processing; legacy claim refusal; complete-before-prepare refusal; metadata bounds and immutable prepared hash; prepared-job restart identity and old-run refusal; Menu preview linkage; erasure blocks new claims, preparation and late completion; prepared Plate/preview paths enter erasure tracking; saved preview reference clears when source author is erased. Deferred content constraints are checked before the success marker.

Erasure initiation runs only against the synthetic author through the existing recorded-erasure database wrapper, using a clearly synthetic receipt that satisfies its shape checks. This does **not** test independent receipt signatures, external ledger persistence, cleanup, Auth deletion, physical object removal, saver-only erasure, actual parallel transactions, Storage bytes or hosted recovery. The test uses the migration role with explicit simulated request claims; user-role grants are covered only by the earlier ownership suite, not comprehensively by this fixture suite.

Approved and executed commands, from the project root:

```sh
node --check scripts/test-photo-worker-flows.mjs
```

```sh
./node_modules/.bin/eslint scripts/test-photo-worker-flows.mjs
```

```sh
node scripts/test-photo-worker-flows.mjs
```

The last command uses local Docker/PostgreSQL, temporarily creates the candidate and synthetic fixture metadata, then rolls everything back. It does not start a worker, activate the candidate, read/upload image bytes, remove files or delete real accounts. Keep the original worker stopped while executing. Three-second lock and 30-second statement limits bound database interference. The new test runner has no activation/commit mode.

## Restart recovery decision and operator runbook

For this candidate, normal explicit decoder rejection is terminal and permits a clean shutdown. Graceful shutdown stops new claims, waits for the current job and releases ownership only when no unfinished journal entries remain. A later normal start can acquire a released run slot. This does not prove the host will allow sufficient shutdown time; hosted interruption testing is still required.

For an abrupt interruption, uncertain upload or lost backend acknowledgement, retain ownership. Do not use an elapsed timer alone to take over. Confirm the previous process stopped and its outstanding requests drained; identify the exact prior run from its start log. Then a fresh process can use:

```sh
node scripts/photo-worker.mjs --recover-stopped-run PREVIOUS_RUN_UUID --writer-stopped --requests-drained
```

`PREVIOUS_RUN_UUID` is the actual non-secret run identifier from the previous start log. The existing explicit backend/environment/service-key settings are required; this command does not discover credentials. **This is a future operational command, not approved for execution here.** It may process pending real jobs; do not run it for tests without an implemented fixture allowlist and exact approval. Where writer/drain evidence is unavailable, keep the run blocked for investigation. Recovery validates existing output bytes and refuses overwrites; a prepared retry that cannot reproduce the same bytes needs review.

Automatic takeover after interrupted writes remains an unresolved availability limitation for alpha. Database run identity prevents old completion calls, but cannot stop a previously issued Storage write. Do not promise unattended two-minute recovery or enable automatic takeover on a hosting platform from these tests.

## Passed checks for the rejection change

Owner approved and agent ran all four checks on 2026-10-14; all passed. Database suites ran sequentially and rolled back. From the project root:

```sh
./node_modules/.bin/eslint scripts/photo-worker-runtime.mjs scripts/photo-worker-backend.mjs scripts/test-photo-worker-runtime.mjs
```

```sh
node scripts/test-photo-worker-runtime.mjs
```

```sh
node scripts/test-photo-worker-sql.mjs
```

```sh
node scripts/test-photo-worker-flows.mjs
```

First two checks are offline: synthetic inputs in memory, explicit decoder rejection versus crash/prepared retry/lost rejection acknowledgement, and continued valid jobs. Last two use rollback-only local SQL; the expanded flow suite uses the eleven-job scope above. No candidate activation, live worker, actual Storage request, cleanup, Auth removal or hosted action is included.

Restricted local end-to-end driver exists at scripts/test-photo-worker-e2e.mjs. Owner approved clear preflight, persistent candidate installation, scoped test/local key lookup and later guarded same-fixture continuation. Candidate COMMIT succeeded; first attempt failed a forbidden profile API check before upload. Driver-only permission fix passed offline checks without widening grants. Approved continuation then passed source uploads, valid Plate/Table WebP conversion/hash/dimensions, malformed rejection, Plate publication, preview conversion/download and Menu link. Ownership close returned true. One synthetic account/Table/Plate/Menu, four jobs and six objects retained. PHOTO_WORKER_E2E.md records exact state/scope/command; do not replay the now-ineligible pre-upload resume. This verifies service-role Storage/database links, not browser display or hosted capacity.
