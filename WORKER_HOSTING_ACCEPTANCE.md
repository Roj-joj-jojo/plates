# Alpha worker hosting — proposed acceptance plan

Prepared 2026-10-14. Local investigation/planning only; no hosted execution approved or performed. Railway is the recommended first candidate, Fly.io a fallback. The owner's total initial budget ceiling is £10–£20/month, not a target spend. Vercel/Supabase remain the recommended website/backend direction, not evidence of configured hosted accounts. External feedback's suggested $5–8 worker cost is a hypothesis rather than an owner-approved acceptance ceiling.

## Findings before a trial

- `scripts/local-media-worker.mjs` does five backend operations in a normal empty, fully installed cycle: erasure-job RPC, picture-cleanup claim RPC and Plate/Table/Menu-preview queue queries. It waits 1.5 seconds after each cycle. Neglecting latency/work, 86,400/1.5 = 57,600 cycles/day, or 288,000 calls/day. Actual frequency is lower and may change when queues/errors occur. Counts do not imply five billable charges per cycle; measure provider-visible CPU/IO/network and selected-plan allowances, rather than inventing a per-request Supabase charge.
- The general worker can claim/delete picture/account cleanup records. Do not run it just to measure idle resources against existing accounts. A photo-only or tightly scoped implementation/test mode is needed; preserve separately designed erasure duties.
- Plate/Table uploads and Menu preview jobs are claimed by changing `pending` to `processing`; normal queue queries select only `pending`. The worker contains no upload/preview reclaim sweep at restart. Inspected original upload/preview migrations do not provide the picture-cleanup queue's expired-claim behaviour. Automatic upload/preview crash recovery must not be assumed. Review later schema/code integrations comprehensively before choosing the recovery change.
- Hosted worker adaptation needs credentials, exact intended-backend checks, native-library/Node compatibility, worker-specific build/start configuration and shutdown/recovery. Recovery is an implementation requirement, not a benchmark flag. A timed-out lease alone cannot prevent a previous unrestricted writer from uploading bytes later; use established writer-stop/ownership principles and preserve erasure barriers.

## Proposed thresholds — not yet owner-approved runtime scope

These are starting recommendations to settle before tests. Do not choose a pass threshold after looking at results. No provider setup, resource limits, remote uploads, process interruption or object cleanup is authorised by this document.

| Check | Proposed fixture/window | Proposed pass condition |
| --- | --- | --- |
| Idle resources and backend load | At least 24 hours empty scoped photo queues | No crashes/stuck claims; stable memory rather than continual growth; provider CPU/network/DB metrics and request count recorded; projected idle cost fits the agreed worker allocation within the total budget. Decide acceptable poll cadence/DB load from measured baseline; no arbitrary API-charge model. |
| Linux processing peak | Retained synthetic JPEG/PNG cases plus approved genuine portrait/landscape HEIC; bounded sequential burst | No memory-limit failure/timeout; output dimensions/content correct; aim for at least 20% memory headroom at the chosen limit. HEIC files larger/more complex than the two reported 2 MB samples may need separate coverage. |
| Upload to visible image | Agreed synthetic test account/Plate/Table/picture targets; normal connection | Proposed target: typical single photo visible within 10 seconds, at least 95% of the agreed set within 30 seconds. Measure from completed original upload and separately capture total user upload wait. Report sample size, network and cold/warm state; small sample is not a production percentile guarantee. |
| Menu preview | Agreed Plate saved by designated fixture saver | Preview correctly stored/displayed without duplicate saved items; proposed availability target 30 seconds under the scoped burst. Snapshot/privacy behaviour preserved. |
| Restart/redeploy recovery | Explicit interruption of only the owned test worker at agreed claim/decode/upload/finalisation stages | Job completes or reaches an explicit recoverable failure within a proposed 2-minute target; no silently stuck `processing` state. Retrying may involve multiple attempts, but one logical result/asset and no untracked served objects. Record deterministic orphan reconciliation; any physical cleanup needs exact target approval. |
| Observed cost | Minimum 72 hours containing idle time and representative jobs | Export aggregate usage/cost evidence, extrapolate idle separately from jobs/transfer and account for region/taxes/other services. Total forecast remains within £10–£20 and a separately chosen worker allocation. Do not extrapolate a burst-only period as a typical month or declare $5 proven from list prices. |

## Evidence and monitoring

- Record process/host peak and baseline memory, active/idle CPU, restart/error counts, oldest pending-job age, queue counts, processing durations, bytes and observed account/service costs. Monitoring should measure aggregate health, not photo content, credentials or signed URLs.
- Alert immediately for dead worker, repeated crashes or growing stuck jobs. Capacity warning should combine sustained resource pressure and queue delay; brief conversion CPU peaks are normal. Proposed RAM-headroom target is not a fixed alarm rule for every sample.
- Configure actual provider warning/hard-limit behaviour only after owner selection/approval. Hard limits can stop photo processing; alerts-only thresholds do not cap spend. Leave room for tax, backend/email/domain/backups and other providers.

## Safe build/test order

1. Confirm an appropriate non-default branch with the owner before changing application/runtime behaviour. Inspect current full recovery/migration chain; design idempotent results, explicit ownership and interruption recovery locally. Discuss any additive schema/behaviour change under project rules.
2. Prepare worker-only build/start and photo-only scoped operation, default-disabled cleanup integration, backend guard/credentials boundaries, optional adaptive idle polling and aggregate metrics. No broad dependency installation or deletion permission implied.
3. Prepare local synthetic acceptance/rollback fixtures and exact commands. Obtain specific permission where required; verify recovery and pipeline locally before hosted interruption.
4. Prepare a concrete external trial scope identifying provider resources/backend, retained files, synthetic accounts/jobs/objects, worker limits, duration, cost ceiling, authorised process stop/restart and any exact cleanup targets. Owner approves external setup/upload/test operations separately before execution. No "throwaway project" creation or destruction assumed.
5. Run the approved checks. On failure, inspect retained state and correct scoped implementation; do not blindly restart or requeue an unfinished writer. Keep artifacts and redact secrets.
6. Accept Railway only after results support budget/reliability. If it falls short, price/test the same workload on Fly or another retained candidate. It is not necessarily a small extra deployment: each needs its own configuration and explicit scope.

## Current evidence

- Owner reports local Android JPEG/9.2 MB/orientation/screenshot/oversized rejection/multi-photo Menu behaviour passed, plus two genuine ~2 MB portrait/landscape HEIC uploads passed.
- Offline synthetic benchmark passed at up to 241.4 MiB peak for six sequential JPEG/preview pairs. It did not run real polling/Storage/HEIC/hosted constraints. See PHOTO_RESOURCE_RESULTS.md.
- No new runtime test performed for this checklist. No provider choice, account creation, paid plan, deployment, mutation, interruption or cleanup occurred.
