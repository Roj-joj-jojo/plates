# Local deletion-index and restore-gate simulation

Prepared 2026-10-10. `scripts/deletion-index-prototype.mjs` is an in-memory model, not a durable deletion index or a control on the running app. It has no database, file storage, network calls, migration or external provider. Its keys and fixtures are generated only in test memory.

## What it models

- Acknowledged intent records contain versioned, environment/type-separated HMAC-SHA-256 tokens for profile and Auth UUIDs. Raw IDs, email, content and keys are absent from exported records. These hashes are pseudonymous, not anonymous.
- Completion follows a matching intent. Duplicate intent/completion calls return existing records; reuse of an operation ID for another identity is refused. Incomplete and completed intents both require replay after an older restore.
- A keyed integrity chain and a separately trusted checkpoint detect alteration, reordering and history truncation. The trusted checkpoint is a separate test value; in production it requires independent durable custody. If both history and checkpoint are rolled back together, this model cannot detect it.
- Restored profile and Auth inventories are matched separately. An Auth account can be matched even if the old backup has no corresponding profile mapping. Sweep callbacks model content/copy blanking and object/Auth removal using synthetic arrays only.
- A simulated gate defaults closed for app, Auth, REST, Realtime, Storage and workers. Sweep failure or process restart keeps it closed. Opening requires completed verification, owner approval and an unchanged independently supplied checkpoint. New index records invalidate an earlier opening attempt.

## Verification command

From the project root:

```sh
node scripts/test-deletion-index-prototype.mjs
```

Expected output is one PASS marker after all assertions. The test changes synthetic data in memory only, with no persistent fixture creation or removal. It checks retries, incomplete intents, matching under old/new keys, unknown/lost keys, altered/truncated records, missing checkpoints, cleanup/verification failure, copied content, orphan Auth matching, peer preservation and closed gate behavior after stale verification/restart.

## Production boundary

Memory acknowledgement has no durability guarantee. The test does not enforce actual API/network isolation, real backup restoration, multi-process coordination, database replay, recovery of admitted Storage writes or deletion from caches/backups. Callbacks and owner-approval booleans model trusted operator actions; they are not authentication controls. The inventory is assumed exhaustive. No request flow uses this index yet, so existing erasure requests do not gain durable restore protection from these files.

Before production use, choose durable storage/key custody, implement acknowledged intent before irreversible database work, design cross-system retries, and connect a verified restore replay interface. A current checkpoint must be acquired and opening coordinated atomically with new intent writes; passing a caller's stale checkpoint into this simulation does not solve that race. Access fencing must exist outside the restored database and cover direct APIs. See `RETENTION_RESTORE_PLAN.md` for the full release contract.

## Recommended next step

Review this model before selecting a hosted index provider. For the first release, prefer an isolated restore with deliberate verification and owner-controlled opening; choose a small independent index service/store with durable idempotent writes and separately protected keys/checkpoints. Specific hosting plans, retention windows, providers and costs remain undecided. No hosted setup is authorised by this recommendation.

## Verification — 2026-10-10

With explicit owner permission, the synthetic test printed its PASS marker. Both prototype/test syntax checks and project lint passed. No persistent data, database, network or real restored system was accessed by those checks.

## Subsequent durable local candidate and real isolated drill

`LOCAL_DELETION_RECORDS.md` records the later append-only filesystem implementation, its authorised tests, empty real-store initialisation and successful actual old-snapshot replay drill. The memory model now optionally hydrates verified records/checkpoint for that candidate; its default remains memory-only. The real drill used the matcher with database/Storage callbacks inside physically isolated containers and never opened access. This extends evidence beyond the original simulation without implementing app enforcement or a hosted gate.
