# Restricted local photo pipeline test

Prepared on 2026-10-14. **Owner-approved local installation and guarded continuation completed; restricted Storage/DB pipeline passed.** Valid Plate/Table photos and Menu preview are ready, malformed Plate upload is failed, all fixtures/files retained, worker ownership released cleanly. First attempt failed before upload, then the driver-only permission fix passed offline checks and the explicitly approved same-fixture continuation passed. Original worker remains stopped and incompatible with installed claims; no continuous replacement worker or hosted service is running.

## Scope and purpose

`PHOTO_WORKER_E2E_PLAN.json` lists approved synthetic identifiers now used by retained fixtures. The driver `scripts/test-photo-worker-e2e.mjs` created exactly one synthetic Auth/profile record and username, one single-member Table, two Plate upload intents and one Table upload intent. It uploaded three in-memory fixtures: a 2400×1200 JPEG, a 1200×2400 PNG and malformed bytes labelled image/jpeg. It processed only those allowlisted jobs, confirming two ready assets and one failed upload.

It then publishes one synthetic photo Plate, creates one allowlisted Menu preview job, processes it, and saves the Plate to that same test account's Menu. Expected output: 2048×1024 Plate WebP, 1024×2048 Table WebP and 640×320 preview WebP, with downloaded hashes matching acknowledged metadata. There are four jobs and six retained Storage objects (three staged inputs and three processed outputs). Generated owner/Table/Plate/save/output/run identifiers are recorded locally in `PHOTO_WORKER_E2E_RESULTS.ndjson`, created exclusively with restricted permissions. Existing result files cause refusal; no overwrite or automatic retry.

Job guards check the allowlisted kind/identifier, owner, staged path, group and preview source/Plate on every backend operation. Output guards check acknowledged asset identity, bucket, path, hash and length before downloads/uploads. The driver does not use global worker polling. Existing active ownership, unfinished journals or processing jobs cause refusal before fixture creation. Existing pending jobs are not claimed or changed. All objects, accounts and records are retained on success or failure; no cleanup, erasure initiation or Auth removal occurs.

This is a service-role Storage roundtrip and database-linkage test, not a browser acceptance test. It does not authenticate the synthetic account, prove fresh signed-URL audience/privacy, inspect the UI, test HEIC, interrupt an actual writer, benchmark idle usage, prove hosted sizing/cost or test full erasure. Auth records have no login password and are created directly in the local database using existing fixture conventions. The fixture account/Plate may be visible in local discovery and remain until separately approved handling.

## Offline review checks — passed

Owner explicitly approved these three checks; agent ran them on 2026-10-14, all passed. No credential/database/Storage access occurred.

From `/Users/roryjohnson/dev/plates`:

```sh
node --check scripts/test-photo-worker-e2e.mjs
```

```sh
./node_modules/.bin/eslint scripts/test-photo-worker-e2e.mjs scripts/photo-worker-e2e-scope.mjs scripts/test-photo-worker-e2e-scope.mjs
```

```sh
node scripts/test-photo-worker-e2e-scope.mjs
```

These do not read credentials, contact Docker/Supabase, start the live worker, create accounts or upload anything. The offline scope tests exercise refusal before backend calls for unrelated identifiers/owners/paths/groups/sources; acknowledgement path/hash restrictions; incomplete/duplicate/excess queue results; and terminal job filtering. Approval to run these checks does not authorise the next section.

## Owner-approved local activation and first execution

Owner approved preflight, activation and restricted test. Read-only preflight returned candidate absent and zero processing in all three queues. Candidate installation COMMIT succeeded. Driver read local credentials in memory and created its fixture account/Table/three upload intents; it then failed its profile API identity check. No source uploads, processing claims, Plate, preview job or Menu save were reached. Retained report has started/fixtures_created/failed entries only.

Code review found the service role has no profile or Menu-save SELECT permission. Driver now verifies backend identity via its allowed upload-record columns, and verifies the saved Menu link through fixture-only SQL instead. No grants, candidate or app permissions changed. The corrected driver has passed entry syntax, lint and offline tests, not yet a second pipeline run.

Real HTTP Storage requests cannot see rollback-only fixture transactions. Running this pipeline requires the candidate schema installed persistently and test fixture transactions committed. The current candidate installs claim triggers on the three real queues: after activation, the original worker will refuse future pending-to-processing claims. Existing records/files are retained. The regular website can still create pending uploads, but the restricted driver will process only its four test jobs. Ordinary photo processing remains paused until a separately approved worker start.

Local activation is a separate owner decision. With all workers stopped/drained and no processing jobs, the proposed command is:

First run this read-only preflight from the project root:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/diagnostics/20261014_photo_worker_activation_preflight.sql
```

This preflight passed before the approved installation. Do not rerun installation: `candidate_not_installed` will now be false. Preflight never proves worker shutdown; the owner's stopped/drained confirmation is also required.

Then, only with explicit activation permission:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/candidates/20261014000100_photo_worker.sql
```

This commits the candidate schema; it does not start the worker or deploy anything. The current candidate itself has no startup processing precondition, so confirming stopped/drained workers and processing state remains an activation prerequisite. The previous rollback-only SQL runners create this same schema and will refuse after persistent activation; they have no applied mode. Activation is not an automatically managed migration, and removal/reversion would need a separately reviewed owner-approved operation. Do not assume it is harmless to restart the legacy worker afterward.

After separately approved activation and fixture scope, the proposed command is:

```sh
node scripts/test-photo-worker-e2e.mjs --execute --original-worker-stopped --expected-origin http://127.0.0.1:54321
```

The origin must exactly match the existing local Supabase API; do not guess a different port. The driver quietly runs the existing `./node_modules/.bin/supabase status -o json` to obtain the local URL/service key in memory. It refuses non-loopback origins and origin mismatches, checks schema readiness, and verifies its exact fixture upload record through the API before uploading. No secrets are printed or saved; `.env.local` is unchanged. SQL calls use the existing `supabase_db_plates` Docker container with 30-second statement/three-second lock timeouts. Storage/SDK fetches have 15-second timeouts; an aborted request is treated as uncertain, never evidence for automatic takeover.

Committed fixture creation temporarily bypasses admission inside its transaction and restores the prior setting before commit. Other sessions do not see that temporary change. Publication and Menu save use fixture-only SQL request claims; no email is sent. Source uploads refuse overwrites. Processing uses two bounded runtime ticks, not an always-on service. Failures retain evidence and may retain worker ownership for manual review; the script never resets jobs, takes over an existing run or retries automatically.

Review the retained report and actual job state before any further run. Browser display, genuine HEIC and hosted acceptance follow as separately scoped checks. No deletion or erasure of retained fixtures is included in this plan.

## Guarded continuation — approved and passed

Owner explicitly approved the manual continuation. Agent ran the command below with approved local Docker/Supabase access; PASS photo worker E2E. The retained account/Table/three pending uploads passed pre-upload read-only revalidation. Local key remained in memory, no secrets logged. Three sources uploaded; first runtime tick completed valid Plate/Table jobs and rejected the malformed Plate job without stopping. Downloaded WebP hashes matched preparation and dimensions were 2048×1024/1024×2048. Fixture Plate publication, preview processing/download at 640×320 and Menu save/preview linkage passed. Final ownership close returned true. No unrelated uploads processed or records/files removed.

All six objects and the original account/Table plus new Plate/preview/Menu remain. The report retains both the first failure and successful continuation. It is no longer eligible for the pre-upload-only resume shortcut; do not replay this command. Browser signed access/display, HEIC, real abrupt restart, idle behaviour and hosted capacity/cost remain untested. Recorded 143 MiB end-of-run RSS is one sample from this driver with small synthetic inputs, not peak/idle worker capacity evidence.

The first run's report is retained and cannot be overwritten by the default command. A separate manual resume flag accepts only the exact three-event pre-upload failure report with matching plan identifiers. It then checks the retained account/profile/Table identity, three exact pending upload records, no existing planned preview, no linked assets/journals or source Storage metadata, and no active/unfinished worker or processing work. All checks must pass before upload/claim. It creates no additional account, Table or source upload intents; appends a new attempt to the original report and continues only the previously approved four-job/six-object scope. Failure at any later stage cannot use this shortcut.

Approved and executed command:

```sh
node scripts/test-photo-worker-e2e.mjs --execute --original-worker-stopped --expected-origin http://127.0.0.1:54321 --resume-approved-fixtures
```

No reinstallation, queue reset, file overwrite/removal or automatic restart is included. Keep original worker stopped. Fresh read-only fixture checks and local service-key lookup precede the same bounded upload processing; any changed state causes refusal.
