# Local account-erasure recovery

This guide covers the local prototype only. It does not authorise deleting any account, object or file. Obtain the exact approvals required by `AGENTS.md` before running cleanup. Keep the general erasure screen disabled while investigating.

## Inspect without changing data

From the project folder, use the read-only summary below. Replace `PROFILE_UUID` with the affected profile ID from its approved scope. It returns counts and the job stage without printing paths, Auth IDs or credentials. It does not claim work, finish uploads or delete anything.

```sh
node scripts/inspect-account-erasure.mjs PROFILE_UUID
```

## What can resume automatically

| Observed state | Recovery behaviour |
| --- | --- |
| Pending object, or removal failure | The next approved worker run retries removal and checks exact-path absence. Storage errors keep cleanup pending. |
| Processing cleanup claim | A fresh claim is protected for two minutes. After that, a worker can reclaim it. Removing an already absent object is safe to retry. |
| `auth_pending` | Database blanking and unlinking already happened. The next approved worker run retries the same Auth target; an already absent Auth identity is accepted before marking the job complete. |
| `complete` | Nothing further is needed for this local job. This does not certify backup, log or external-cache erasure. |

The rollback-only SQL suite checks fresh/expired claims, removal retries, unfinished-upload blocking and repeated advancement of the Auth stage. The earlier real HTTP test verified Storage/Auth cleanup. The new browser harness additionally tests a controlled stop/restart; its scope document records whether that run has passed. An abrupt process crash inside a Storage/Auth API call has not been exercised.

## An unfinished upload needs separate recovery

A `processing` **upload attempt** differs from a cleanup claim. It has no automatic expiry: elapsed time cannot prove that another process will not write bytes later. The two-minute cleanup lease and reconciliation delay do not resolve this.

1. Identify the exact upload process and bucket/path privately. Confirm that its writer has stopped and cannot resume; check decoder children and other workers as well.
2. Review the exact path against the approved deletion scope. Obtain separate permission if the path or operation is outside that scope.
3. Prepare a scoped recovery operation using `finish_media_object_attempt` for that exact path only. Obtain approval before applying it; this can allow later Auth deletion. Do not mark a queue row removed manually. The existing function requeues the affected path and clears reconciliation, so cleanup must check it again.
4. Resume only the approved cleanup worker, verify Storage absence and the final Auth result, and record the outcome in `HANDOVER.md`.

There is no automatic abandoned-upload recovery command yet. Keep the job blocked if the writer cannot be ruled out. Production needs a tested recovery procedure or a mechanism that prevents a replaced worker from writing, alongside durable deletion-index and restore-sweep protection.

### Scoped operator candidate — 2026-10-10

`scripts/recover-abandoned-upload.mjs` now implements the manual, local-only step above. It is not an automatic recovery command. Simulated-runner and static checks passed. With separate owner approval, `scripts/test-recover-abandoned-upload-sql.mjs` also passed against the applied local schema with every synthetic fixture rolled back: all three buckets, wrong/missing targets, shared-cleaning-job refusal, repeat refusal, requeue/reconciliation reset and rollback after a later error. Abrupt writer shutdown and simultaneous-process lock contention remain untested; no real recovery ran.

Prepare a private JSON file outside the repository containing exactly `profileId`, `bucket` and `objectPath`, copied from the reviewed recovery target. Supported buckets are `plate-media`, `table-media` and `menu-previews`. Do not put credentials or Auth IDs in it. Example values below are placeholders, not an approved target:

```json
{
  "profileId": "11111111-1111-4111-8111-111111111111",
  "bucket": "plate-media",
  "objectPath": "REPLACE_WITH_EXACT_APPROVED_PATH.webp"
}
```

From the project root, this command only checks eligibility in the local database and prints booleans. Replace `/private/tmp/APPROVED_SCOPE.json` with the private scope file. It does not disclose the target path or change data:

```sh
node scripts/recover-abandoned-upload.mjs /private/tmp/APPROVED_SCOPE.json
```

Do not run the following application command until the owner separately approves that exact target/operation and the operator verifies that every relevant writer, decoder and in-flight Storage request has stopped and cannot resume. The tool cannot establish writer shutdown. The flags record operator confirmations; their presence does not grant approval.

```sh
node scripts/recover-abandoned-upload.mjs /private/tmp/APPROVED_SCOPE.json --apply --scope-approved --writer-stopped
```

This requires a processing attempt linked to that profile's cleaning job. It refuses a path linked to another cleaning job. Within a transaction it rechecks eligibility, calls the existing completion function, and requires the attempt to be finished, the queue path pending and reconciliation cleared before committing. Locks briefly block concurrent queue writes (five-second lock timeout); any SQL error rolls back the transaction. It does not remove Storage bytes, advance identity or start a worker. It can unblock later Auth deletion, which is why exact approval is required. A client interruption can leave the commit outcome unknown: inspect before attempting recovery again; do not infer rollback from the lack of output.

After successful recovery, inspect the job, resume only the separately approved cleanup worker, verify exact object absence and Auth completion, and record the results. A finished/missing attempt or a completed job is refused rather than silently treated as newly recovered. See `RETENTION_RESTORE_PLAN.md` for production limitations and pending acceptance checks.

### Writer-crash drill — passed locally

On 2026-10-10 the owner approved preparation of a fresh disposable run, `a77e98a1-e179-4881-9d87-a0da0724e959`. Its [exact scope](supabase/tests/account-erasure-scopes/a77e98a1-e179-4881-9d87-a0da0724e959.md) contains the new synthetic author/content/Table operations, seven removal paths and retained peer. Preparation created labelled local fixtures; it did not start a writer/cleanup worker or request erasure. The reserved blocker object is uploaded only during approved execution.

The new `--crash-recovery-approved` harness mode starts one IPC-connected fixture writer. That writer uses the actual image decoder, awaits its termination, registers/uploads the exact blocker once and pauses before database finalisation. After initial cleanup and unfinished-attempt blocking, the harness abruptly stops only that owned writer with SIGKILL and awaits its exit. Restarted cleanup must still refuse identity completion; the scoped recovery tool then requeues the abandoned attempt, and final Storage/Auth checks must preserve the peer. This tests the acknowledged-upload/finalisation gap, not an in-flight Storage/Auth call or arbitrary hosted writers.

Only after exact scope approval, from the project root:

```sh
node --env-file=.env.local supabase/tests/local_account_erasure_http.mjs --crash-recovery-approved a77e98a1-e179-4881-9d87-a0da0724e959
```

This command performs irreversible erasure of the specified disposable author and photos, starts/stops the restricted cleanup worker and abruptly kills its own fixture writer. No preview restart or general worker is involved. Expected output is stage-specific PASS markers; any failure must be reviewed using the saved private fixture state, not rerun blindly. The mode refuses reuse once its fixture writer started or the run completed; partial recovery needs an independently reviewed exact operation. The CLI flag does not grant approval. Lint/syntax checks passed. The owner subsequently approved the full exact scope; the crash mode completed successfully on 2026-10-10, including writer exit, unfinished-attempt blocking through restart, scoped recovery, exact removal/Auth verification and retained peer checks. Both isolated processes stopped. Do not rerun the completed fixture.

## Disposable browser test

The prepared run is `cb64a4a0-6a85-4b18-bfe2-7e1d556a3e33`; its exact deletion targets are in [the scope](supabase/tests/account-erasure-scopes/cb64a4a0-6a85-4b18-bfe2-7e1d556a3e33.md). The owner specifically approved this run on 2026-10-10.

```sh
node --env-file=.env.local supabase/tests/local_account_erasure_http.mjs --browser-approved cb64a4a0-6a85-4b18-bfe2-7e1d556a3e33
```

This waits up to ten minutes for the browser submission, checks the exact queue, then starts/stops/restarts only its restricted worker. It preserves the peer. Never substitute another run without reviewing its scope and obtaining approval. Restore the regular preview without temporary erasure flags afterward. The harness refuses to repeat a completed run.
