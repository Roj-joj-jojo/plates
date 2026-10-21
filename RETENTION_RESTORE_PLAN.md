# Retention and restore protection — release preparation

Reviewed 2026-10-10. This is a local design and evidence register, not a deployed control or a user-facing deletion guarantee. No hosted project settings were inspected. The owner accepted Vercel/Supabase with manual backups as the initial direction; region, actual plans/settings, export retention, log drains and worker hosting remain unconfirmed. Real encrypted local database/photo backup, isolated database/Storage restoration and a durable-intent isolated replay drill passed. See `LOCAL_BACKUP_GUIDE.md` and `LOCAL_DELETION_RECORDS.md` for coverage and limits. The trusted local app/worker acknowledgement bridge and private database mirror are now applied and configured; candidate/applied rollback tests and scoped disposable HTTP/Storage/Auth acceptance passed. Hosted protection is still absent.

## Provider evidence and remaining decisions

| Copy | Public evidence | Required project decision/evidence |
| --- | --- | --- |
| Supabase database backups | Daily-backup access windows are 7 days on Pro, 14 on Team and up to 30 on Enterprise. PITR has its own configured window. These are documented recovery windows, not proof of every internal copy's physical purge deadline. | Choose plan and recovery window; inventory exports, clones and development restores; confirm actual deletion/expiry guarantees where needed. |
| Storage bytes | Database backups include Storage metadata, not the actual objects; database restore does not recover deleted objects. | Inventory separate object copies/versioning/exports, specify expiry and test their restore process independently. Do not infer object purge from database backup settings. |
| Supabase logs | Retention depends on plan. Logs can be downloaded or drained elsewhere. | Record the selected plan's exact service-log and audit-log windows, payload fields, drains and export retention. Avoid content, credentials and signed URLs in application logs. |
| Vercel runtime logs | Documented windows: Hobby 1 hour; Pro 1 day; Enterprise 3 days; Observability Plus 30 days. | Confirm selected plan/add-ons, drains, other log categories and exported copies. Dashboard visibility is not by itself a complete physical-purge guarantee. |
| Photo delivery/cache | Supabase Smart CDN invalidation after object changes/deletion can take up to 60 seconds. Browser caches can outlive invalidation. Smart CDN supports signed URLs. | Measure hosted deletion using previously issued URLs with warmed caches, including transformations; inspect browser cache headers and every app/image proxy. Local old-URL denial is insufficient hosted evidence. |
| Deletion index | No provider or storage selected. Keyed hashes remain pseudonymous records. | Choose independently durable storage, access controls, key custody, retention and recovery verification; include its own backup lifecycle. |

Sources checked 2026-10-10: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [Supabase logs](https://supabase.com/docs/guides/observability/logs), [Vercel runtime logs](https://vercel.com/docs/logs/runtime), [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn). Recheck before launch and after changing plans. These public sources do not establish this project's settings.

No retention duration is adopted by this document. Publish a retention statement only after the chosen windows, exported copies and hosted cache behavior are verified. Explain active-system erasure separately from restricted backup expiry; do not promise remote deletion of copies a recipient has already downloaded.

### Restore-hosting caveat checked 2026-10-10

Supabase's [network restrictions](https://supabase.com/docs/guides/platform/network-restrictions) apply to Postgres/pooler access, not HTTPS Auth, REST or Storage. They cannot implement the required complete restore gate. Its [restore-to-new-project](https://supabase.com/docs/guides/platform/clone-project) flow copies Auth data and can restart externally acting extensions as soon as restoration finishes. Creating a new hosted project alone does not establish isolation. The provider documentation recommends a logical restore when external jobs need inspection before running. Before selecting a hosted restore method, verify that public API access and externally acting jobs stay fenced throughout restore and replay. Prefer a controlled isolated environment; the exact hosted mechanism remains unresolved.

## Abandoned uploads: first implementation slice

The local scoped operator tool is `scripts/recover-abandoned-upload.mjs`; the procedure is in `ACCOUNT_ERASURE_RECOVERY.md`. It addresses one registered object attempt after its writer has been conclusively stopped. It is not automatic expiry, a hosted worker, or a fix for every processing upload intent/preview job. A crash before object registration can also leave a processing intent/job and needs separate scoped handling.

Production replacement workers must not rely on timestamps alone. A worker with the existing service key can write directly to Storage even after a database lease expires. A production design needs either verified shutdown/revocation plus draining in-flight requests, or a write boundary that enforces worker ownership before admitting bytes and tracks requests already admitted. A database token check followed by an unrestricted Storage upload leaves a race. Decide the hosted worker and write boundary before implementing automatic recovery.

## Proposed deletion-index contract

The owner agreed to keyed hashes of stable erased identifiers in durable storage outside the restored backup. The following expands that direction for review; it is not implemented.

- Use versioned HMAC-SHA-256 records with explicit application/environment and identifier-type separation. Include both profile and Auth identity matching tokens: an older restore can contain identity mapping or Auth state from before current erasure. Do not store names, email, original content or object bytes in this index.
- Each intent carries a unique operation ID, matching tokens, key version, schema/erasure-policy version and durable ordering/checkpoint information. Completion is separate from intent. An incomplete intent still requires replay after restore.
- Keep keys outside application database backups and source control. Retain every key version needed to match a still-restorable backup. Losing the key or index blocks restoration; rotating a key without retaining the prior version breaks historical matching.
- Storage must support durable acknowledged writes, idempotent operation IDs, integrity checks and detection of missing/truncated history against an independently trusted checkpoint. A local JSON file or index in the restored database does not meet this contract.
- Write and acknowledge intent before any erasure can become irreversible. Then run access cutoff/blanking and cleanup. A database outbox alone is insufficient because restoring an earlier backup also loses that outbox. Define the cross-system retry states and acknowledgement UI before changing the request flow.
- A pending external intent must be retried safely after crashes before/after the database transaction. Reuse its operation ID; never drop it merely because the app response failed. Completion must mean verified active-system cleanup, with backup retention tracked separately.
- Retain tokens and required key versions until every relevant backup, export, clone and separately restorable object copy is outside its approved retention period, with a verified safety margin. No automatic index deletion is authorised or implemented.

## Proposed restore gate

1. Fence public access **before** restoration, using a control outside the database being restored. Stop ordinary workers and prevent direct Supabase Auth, REST, Realtime and Storage access as well as app access. An app-only maintenance screen leaves direct API access open. Restore into an isolated environment unless the provider can enforce this boundary throughout an in-place restore.
2. Load and verify the independent index/checkpoint and required key versions. Keep the gate closed for unavailable storage, unknown key versions, missing history or integrity failure. Never interpret an empty/unavailable index as permission to serve.
3. Match restored profile/Auth identifiers against intents. Reapply blanking and private-object cleanup, including affected Menu copies, source previews, historical paths, Auth state and any restored object exports. Existing self-erasure RPCs require an active caller and are not yet a restore replay interface; prepare a narrowly privileged idempotent replay path.
4. Resume cleanup only within the approved restored environment; resolve unfinished writers safely. Reverify affected account access, content stubs, object absence and old URLs while preserving unrelated users/content.
5. Verify against a fresh index checkpoint before opening access. Coordinate any new intents with the opening boundary so a stale sweep cannot open the system. Record restore generation, checkpoint and verification result outside the restored backup.
6. Open public/API/worker access only after successful checks and owner approval. Failure or operator restart leaves the gate closed. New backup exports must preserve the isolation and retention rules.

## Acceptance checks still required

- Recovery SQL: rollback-only real-database checks for wrong/missing path, completed attempt, shared cleaning jobs, fresh eligibility checks, lock contention, transaction rollback and requeue/reconciliation invalidation. Then an exactly approved disposable crash/recovery test with observed writer shutdown and Storage/Auth verification. Simulated command-runner tests do not establish SQL behavior.
- Index: crash before/after each durable write and database transition, retries, duplicate operation IDs, unavailable store, key rotation, tampered/truncated history and replay of incomplete intents.
- Restore: an old synthetic backup and independent index; revived Auth/content/object metadata; independently restored bytes; unrelated-peer preservation; direct API denial during restore; stale/missing checkpoint; restart mid-sweep; final opening race.
- Retention: verify actual hosted plan/settings and export/drain inventory; record chosen windows and provider guarantees; hosted cache tests and user-facing wording review.

## Ordered next steps

1. Review the local recovery candidate and authorise rollback-only database verification separately. Approve exact real recovery targets only after writer-stop evidence exists.
2. Select intended hosted plans and worker deployment model; record chosen retention windows and independently stored copies. No hosted access is authorised by this plan.
3. Select independent index storage/key custody and a gate covering direct APIs; then implement a local simulated index/restore prototype before any hosted setup.
4. Run approved restore/retention acceptance tests and prepare accurate release wording. Keep general account erasure disabled until the release gates are met.

## 2026-10-10 local verification update

The owner separately authorised rollback-only recovery SQL verification. `scripts/test-recover-abandoned-upload-sql.mjs` passed against the applied schema for all three served-media buckets, wrong/missing targets, shared-cleaning-job refusal, repeat refusal, requeue/reconciliation invalidation and rollback after a later error. All fixtures rolled back. No Storage/Auth API or real recovery ran. Simultaneous-process lock contention, abrupt writer shutdown and hosted recovery remain untested. The ordered next step is an exactly scoped disposable writer-stop/recovery drill; index storage/key custody and hosted plans remain unresolved.

## 2026-10-10 crash-drill and prototype update

The exactly approved acknowledged-upload/finalisation crash drill passed, including observed writer/decoder exit, unfinished-attempt blocking through restart, scoped recovery requeue, exact seven-object/Auth cleanup and peer preservation. See its scope outcome and `ACCOUNT_ERASURE_RECOVERY.md`; no general worker is running.

The owner agreed to build the local restore model before hosted commitments. `DELETION_INDEX_PROTOTYPE.md` records its in-memory scope and successful synthetic tests; syntax/lint also passed. Earlier unimplemented-model notes above are historical. Durable index storage, cross-system acknowledgement, actual erasure integration and real API fencing are still unimplemented. No hosted plan, provider, retention window or configuration was adopted. Next: review the contract and choose independent index/key/checkpoint custody and a verified isolated restore path before integration.

## 2026-10-10 interim local-copy direction

The owner accepted a deletion table in the main project plus a separately preserved current record and manual restore procedure, with the independent record kept locally until automation. A second hosted project is optional. This supersedes any implication that a specific extra project is required; the record must survive the main database restore/loss.

Before each irreversible erasure, durably record its intent in the independently preserved copy and verify it is readable, with required key versions available. Keep it private and outside the project/repository and ordinary restore set. Maintain an independently protected device copy to address loss of the Mac. An occasional export made after deletion can leave a gap; a weekly backup is not a substitute for per-erasure recording.

A manual restore must remain isolated until the current independent record has been checked, relevant erasures reapplied and cleanup verified. No deletion table/exporter, destination, key custody or actual restore gate has been implemented by this decision. Prepare and test that process before relying on it for a friends trial; general erasure remains disabled. Hosted retention and automation are still future work.

## 2026-10-10 real backup/restore update

The owner accepted Vercel/Supabase with manual backup initially and selected private local backup/key folders. A real 34-part encrypted export (full database, roles without passwords, 32 Storage objects) passed authentication/checksum verification. The approved network-isolated full database restore passed count matching and the profile RLS flag after correcting PostgreSQL 17 bootstrap-role identity in the scratch copy. That container stopped and remains private; the original database was untouched. See `LOCAL_BACKUP_GUIDE.md` for exact locations and commands.

This tests database reconstruction and photo-file integrity, not a working photo-service restore, complete application/privacy behavior or actual deletion replay. The independent current deletion-record workflow is still missing. No hosted setup/retention period, external backup copy or automatic schedule was created. General erasure remains disabled; the next safety slice is durable per-erasure recording and isolated replay, followed by explicitly authorised hosted preparation.

## 2026-10-10 subsequent Storage and durable-intent replay acceptance

The separately approved real Storage test passed all 32 restored object hashes, administrative/signed delivery and anonymous/public/outsider denial. An append-only local record/checkpoint candidate passed its filesystem tests; the owner authorised initialisation of empty real histories and a dedicated index key outside the project.

A later approved isolated fixture drill captured a historical database/35-object snapshot before its independent test intent, then restored it into another isolated pair. Disk-persisted matching, existing erasure transaction, exact two-path removal, content/copy blanking and scratch Auth-row removal passed; peer and all 32 original photo hashes were preserved, and completion was appended durably. No public access was opened and both pairs stopped. Earlier untested-Storage/replay notes above describe preceding milestones.

Remaining release controls: enforce acknowledged intent at every real request entry point and maintain the agreed main-database mirror; protect current checkpoint/key/log copies against Mac loss; implement/verify hosted direct-API fencing and replay/Auth behavior; choose hosted retention and test transforms/CDN. The local final-opening coordination remains modelled, not a production gate. General account erasure remains disabled.

## 2026-10-10 local acknowledgement integration accepted

The owner approved local migration 20261010000500 and its selected private paths. The server action derives the Auth identity, the shared coordinator acknowledges the independent intent/checkpoint before database cutoff, and the private mirror/trigger closes the former direct request path. The worker checks those receipts before removal and records durable completion before completing the database job. Candidate and applied-schema rollback suites, synthetic filesystem/coordinator/index checks, lint/typecheck/syntax and Webpack build passed.

The exact disposable HTTP acceptance run also passed actual Storage/Auth cleanup, old URL/refresh denial, upload blocking through restricted-worker restart, peer preservation and durable intent/completion matching. The worker stopped; the real local log now retains this test author at sequence two. General erasure remains disabled. The Next action was compiled/reviewed but not submitted through a browser. This supersedes earlier absent-local-integration notes; hosted adapter, independent external custody, complete hosted restore fencing/replay and provider retention/cache acceptance remain unresolved.
