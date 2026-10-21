# Local deletion records — candidate workflow

Updated 2026-10-10. This workflow stores deletion intents outside the application database. The local app/worker connection is implemented, its migration is applied locally, and candidate/applied-schema rollback tests plus the exactly approved HTTP/Storage/Auth acceptance run passed. General account erasure remains disabled. Results are recorded in HANDOVER.md.

## App and worker connection

The Account screen now calls a server action that checks the signed-in identity with Auth. It accepts only the typed confirmation, never an account identifier from the browser. The trusted local server reserves a stable operation in the private database mirror, verifies the independent history/key, durably appends the intent and checkpoint, and then passes its receipt to the guarded database transaction. Only after that transaction succeeds does the screen acknowledge the request and sign out. A failed database response leaves the intent available for a safe retry with the same operation; it is never discarded.

Migration `20261010000500_recorded_account_erasure.sql` adds the private mirror and service-only reservation/request/receipt/completion functions, guards new cleanup jobs, and revokes the old client request and worker completion entry points. PostgreSQL validates receipt shape and identity reservation; the trusted server/worker verifies its keyed integrity and durable filesystem acknowledgement. The key stays outside PostgreSQL. This is a trusted service boundary, not protection against an operator who already controls the database administrator/service credentials.

The local worker verifies each job's mirrored intent against the independent history before claiming cleanup and again before Storage/Auth removal. After the Auth API confirms deletion or absence, the worker durably appends completion. The guarded database function then verifies Auth absence and cleanup state before marking the job complete. An interrupted completion/database acknowledgement can retry the same receipt. Missing keys, corrupted/stale history, conflicting receipts or legacy jobs without a receipt stop erasure.

Configuration uses `ACCOUNT_ERASURE_RECORDS_MODE=local`, `LOCAL_ERASURE_RECORDS_FOLDER`, `LOCAL_ERASURE_CHECKPOINTS_FOLDER` and `LOCAL_ERASURE_KEY_PATH`. The app additionally requires `ACCOUNT_ERASURE_ENABLED=true`; the optional `ACCOUNT_ERASURE_TEST_AUTH_ID` limits its screen/action to one approved disposable identity. General enabling is separate from setting the record paths. The server uses the installed local Supabase CLI to obtain the local service credential in memory; it is never sent to the browser or stored in this document. App and operator commands run from the project root. Hosted Supabase URLs are refused by this local adapter.

Authorised synthetic coordinator tests, filesystem/index tests, candidate and applied-schema rollback-only SQL suites, lint, typecheck, syntax and a Webpack build passed. The build initially exposed an unavailable bundled `import.meta.dirname`; using the project working directory corrected it and the full build passed. With specific approval, only migration `20261010000500` was applied locally and the selected mode/paths were added to `.env.local`, without adding the general enabling flag.

The exactly approved disposable run `42d96858-7a49-4331-bd82-79e7c7363719` passed through the shared trusted request coordinator and actual local database/Storage/Auth services. Accepted receipt matched the durable intent; access cutoff, content/copy blanking, Table changes, exact seven-path removal, old signed-URL denial, Auth deletion/refresh denial and peer preservation passed. An unfinished upload blocked identity completion across the restricted worker's restart. Durable completion matched the database mirror, which cleared its raw Auth identity. The worker stopped. The configured independent history now verifies at sequence two with one synthetic-author intent and completion; these must remain. This run did not submit the new Next server action through a browser; its adapter was reviewed and passed typecheck/build, while the shared coordinator and worker received the actual service acceptance test.

## Verified local state — 2026-10-10

With specific owner permission, the filesystem tests, existing index simulation, syntax and lint passed. Tests covered durable reopen, idempotency, crash between history/checkpoint sync, exact pending-event retry, conflicting writes, wrong identity reuse, lost keys, corruption and history rollback. Tests retain labelled private synthetic folders and perform no account erasure.

The owner authorised initialisation of the real local store: `/Users/roryjohnson/Plates Deletion Records`, `/Users/roryjohnson/Plates Deletion Checkpoints`, and the dedicated `/Users/roryjohnson/Plates Backup Keys/deletion-index-v1.key`. Initialisation and verification passed at sequence zero; the subsequent approved disposable acceptance run now has its intent/completion there as described above. This is separate from the synthetic replay-drill log. No external-device copy has been made.

The separately approved real isolated replay drill also passed. `scripts/local-restore-replay-drill.mjs` prepared two disposable accounts, a Plate/peer Menu copy and three photos only inside the already restored `42a10f01` copies. It captured an encrypted historical database/35-object snapshot, then durably recorded an incomplete intent in its separate private test log. Approved execution restored that snapshot into new `42a10f02` copies, matched the exact author against fresh restored profile/Auth inventories, invoked the existing erasure transaction, removed only the two approved cloned paths, advanced guarded identity cleanup and deleted only that synthetic Auth row from the scratch database. Actual profile/Plate/Menu blanking, peer preservation and all 32 original photo hashes passed. Completion was subsequently appended and verified on disk. Both pairs are stopped and all files remain.

The replay callback made real database and Storage changes in isolated copies. `SimulatedRestoreGate` still models opening coordination; actual isolation came from network-none containers with no published ports, and no opening occurred. Replay Auth removal used a scoped scratch SQL deletion. The subsequent active-system acceptance run tested actual local Auth deletion/session-refresh denial through the new record workflow, as described above. No crash mid-replay, orphan-Auth real replay, external-device checkpoint recovery or concurrent final opening was tested. The earlier simulation continues to cover model-only cases. General erasure remains disabled.

## Manual operator sequence (CLI and isolated replay)

1. Verify the independently kept log, checkpoint history and index key before considering an erasure. Confirm the intended local environment and erasure policy version.
2. Prepare a private exact scope containing `operationId`, `profileId` and `authId`. Record the intent and receive a durable acknowledgement before requesting irreversible database/Storage/Auth work. The identifiers are read only from that private scope and replaced by keyed matching tokens in the log. The raw scope must remain private; its retention needs separate review.
3. Obtain the project's exact erasure approval and execute only that scope using the existing guarded procedure. This candidate does not invoke it automatically. A recorded intent alone does not mean the account has been erased.
4. Verify active-system cleanup, then append completion using a scope with `operationId` and `verifiedActiveCleanup: true`. Incomplete and completed intents both require consideration after restore.
5. Preserve the latest log and checkpoint history on independently protected storage, and keep a separately protected index-key copy. A local acknowledgement proves local file sync, not an external device copy or protection against Mac loss.

## Files and crash behavior

The history and checkpoint history live in separate private directories outside the project. A dedicated index key lives outside both directories and is separate from the backup encryption key. The CLI currently uses namespace `plates/local/erasure-policy-20261010` and key version `v1`; it must not be reused for a hosted environment. Key rotation and hosted writers are not implemented.

Each event is a new numbered private file, authenticated by the existing keyed integrity chain. Each acknowledged sequence has a new matching checkpoint file in the separate directory. Creation refuses overwrite; file and directory sync precede success. Missing/reordered/altered history, unknown keys and inconsistent checkpoints cause refusal. No lock file needs automatic deletion. Concurrent writers compete for the same next filename; a conflicting operation must retry against verified history and cannot overwrite the winner.

A crash after a record sync but before checkpoint sync leaves an unacknowledged intent. Verification refuses it. Retrying the same operation and identity can finish its checkpoint; another operation is refused until that pending event is acknowledged. A partial or invalid file is preserved and blocks the workflow; do not reset, remove or edit real history to make verification pass. Any recovery requires review and exact owner authorisation.

These checks detect rollback of the history against a newer separately retained checkpoint. Rolling back or losing both histories together cannot be detected from those files alone. Separate folders on one Mac do not establish independent device custody. Operators must preserve a current external checkpoint/copy before relying on this workflow for real-user deletion. The tool does not enforce that external copy.

## Commands, after destination approval

Run from `/Users/roryjohnson/dev/plates`. The placeholders below are private absolute paths selected by the owner; none is set up automatically by this document.

```sh
node scripts/local-deletion-record-cli.mjs init RECORDS_FOLDER CHECKPOINTS_FOLDER INDEX_KEY_PATH --approved-new-local-store
```

This creates private folders and a new dedicated key, then initialises empty histories. It refuses existing key/history overwrite and deletes nothing. An interrupted setup can leave partial files for review; do not rerun blindly.

```sh
node scripts/local-deletion-record-cli.mjs verify RECORDS_FOLDER CHECKPOINTS_FOLDER INDEX_KEY_PATH
```

This checks files and reports counts only, without database/network access.

```sh
node scripts/local-deletion-record-cli.mjs intent RECORDS_FOLDER CHECKPOINTS_FOLDER INDEX_KEY_PATH PRIVATE_INTENT_SCOPE
```

This reads an owner-only JSON scope and appends the acknowledged intent. Reuse the same operation ID for retries. It does not erase anything. Completion is separate:

```sh
node scripts/local-deletion-record-cli.mjs complete RECORDS_FOLDER CHECKPOINTS_FOLDER INDEX_KEY_PATH PRIVATE_COMPLETION_SCOPE
```

The completion flag is an operator assertion, not an independently performed cleanup check.

## Remaining hosted and recovery work

The local acknowledgement bridge is applied, configured and verified through the approved disposable scope. General enabling remains a separate owner decision. The local adapter cannot be used for Vercel/hosted Supabase; a separately reviewed durable hosted writer and key/checkpoint custody are still required before hosted erasure.

The gate's final-opening logic remains a simulation. The isolated drill now feeds persisted records into its matcher and proves real database blanking, exact Storage cleanup and scratch Auth-row removal for the reviewed fixture. Complete hosted inventory/replay, independently current external checkpoint custody and hosted API fencing still need acceptance tests. A local filesystem test alone is not proof of those controls; the successful isolated drill remains deliberately narrow.
