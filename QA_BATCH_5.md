# QA Batch 5 — Notifications

## Current result — two-account browser checks passed, 17 October

Owner asked agent to test using two accounts. Existing Firefox owner and in-app Social HTTP Peer fixture sessions were available; no sign-in, credentials or account changes required. All new content confined to **QA Batch 5 notifications 17 Oct**, Table `b71a14f1-75d3-40cb-baf0-dc2b8ff1f93b`. Retained two messages, one question (`b1a61bde-bff9-46be-8614-06b16121d451`) and three replies, with two members. No cleanup authorised/performed.

Passed in browser:

- Addition alert reached peer; refreshing/opening activity list preserved unread.
- Two messages, one containing a mention, produced three updates including addition, one grouped Table row/badge unit, one mention. No duplicate mention alert in bell.
- Opening latest message targeted its entry; viewed messages and addition cleared. Later question/reply generated fresh unread activity.
- Viewing Table chat acknowledged question card while its unseen thread reply remained unread. Latest-update link targeted the exact reply; viewing it cleared that receipt.
- Peer replies reached Firefox owner; own replies did not create peer self-alerts. First peer reply appeared live in the visible Firefox thread. A later reply stayed unread while the original Firefox thread was an unselected tab and activity was selected; list refresh preserved it. Opening its reply destination cleared it. Both accounts ended up to date.
- No captured in-app client errors. Screenshot of grouped state: `/private/tmp/plates-qa-batch5-grouped.png`.

Limits: in-app tabs reported visible even when another in-app tab was selected, so no hidden-tab claim relies on them; the background check used native Firefox's unselected conversation tab. Did not newly browser-test offscreen clipping thresholds, introduced/removed edited mentions, >100 replies, membership removal/rejoin/closure, failure/retry or follow acceptance. These have applicable automated checks, but do not equate to browser acceptance; existing follow/privacy relationships were preserved. No photo worker, uploads, SQL/terminal tests, source edits, dependencies, Git, deletion or remote action in this browser pass. Preview65569 and worker stopped/drained state retained. Temporary Firefox QA tab left on activity; original Firefox conversation tab retained. Next review remaining acceptance limits before Batch6 navigation work.

## Earlier checkpoints

**Local activation update, 17 October:** Owner approved preflight, installation and installed rollback suite. All seven preflight checks passed; candidate committed locally, copying two eligible existing mention records with read state preserved. PostgREST schema reload succeeded; `node scripts/test-activity-notifications.mjs --applied` passed with fixture changes rolled back. Read-only peer browser confirms ready/up-to-date activity and Table mentions absent from bell, with no captured client errors. Live two-account generation/visible-read acceptance still pending. Candidate remains outside managed migrations: do not reinstall or run the default candidate-creation test against installed objects; use `--applied` only with specific test permission. Earlier not-installed/preflight-pending descriptions below preserve the preparation checkpoint and are superseded by this update.

17 October 2026. Implementation built and rollback-tested locally; database candidate **not installed**. Owner confirmed the bell/envelope split and visible-rendered-only read rules. Same-session feature branch confirmation carried forward; no Git used.

## Behavior prepared

- Bell: follow requests, new followers, accepted follow requests and comments on original Plates. Pending requests remain actionable even after being seen.
- Envelope: one unread row and badge unit per Table, grouping additions, messages, questions, shares, replies and mentions. No duplicate Table mention in the bell after backend activation.
- Opening the activity list does not acknowledge anything. Visible message/root/reply content, or the visible Table header for an addition, acknowledges only its own rendered receipts after a short dwell. Newer versions, unloaded content and background tabs remain unread.
- Late reply destinations can load the linked reply beyond the existing first-100 window; the UI explains any omitted replies between the initial window and linked reply.
- Current membership periods and source/Table availability guard lists and acknowledgment. Rejoining starts a new activity period. Sender/self actions, idempotent retries and ordinary content edits do not create duplicate alerts; newly introduced mentions can create a new receipt.
- Existing eligible mention metadata moves into the envelope, preserving read state. No ordinary historical message or acceptance backfill. Existing mention rows remain retained.
- Account-erasure cutoff scrubs new activity and acceptance identity links. No copied content or photo paths in new notification records.
- Until activation, readiness handling retains existing bell mentions and shows Table activity as unavailable.

## Prepared files

- Candidate: `supabase/candidates/20261017000100_activity_notifications.sql`.
- Database fixture/runner: `supabase/tests/activity_notifications.sql`, `scripts/test-activity-notifications.mjs`.
- Visibility helper/offline checks: `src/lib/activity-visibility.ts`, `scripts/test-activity-visibility.mjs`.
- Table activity and focused reply helpers: `src/lib/supabase/table-activity.ts`, `src/lib/supabase/thread-replies.ts`.
- New activity route, header indicators/read markers; connected Table/message/question/share pages and shared replies receive source/version-scoped receipts. Follow notification helper/list includes acceptance.

## Verification so far

- `npm run lint`: passed.
- `npm run typecheck`: passed after fixing account-ID capture in asynchronous badge loading.
- `node --check scripts/test-activity-notifications.mjs`: passed.
- `node scripts/test-activity-visibility.mjs`: passed; Node emitted a module-format detection warning. No package configuration changed for this warning.
- Rollback database test: passed, including grouping/retries/edited mentions/follow acceptance, old-version and unloaded/late-reply receipts, outsider isolation, source removal before membership changes, newer-message protection, rejoin/closure and fixture recipient/sender erasure cutoffs. First attempt hit an existing trigger name; new trigger renamed `profiles_clear_table_notifications`, then passed. All transactions rolled back.
- Production build: passed. Phone inspection prompted a focused header adjustment: on small screens the three controls have their own row, keeping the description readable. Final lint/types/build passed after this adjustment.
- Read-only browser: activity readiness fallback and existing bell/legacy mentions loaded in the existing peer session. Phone width360:44px controls, no horizontal overflow, readable header. Viewport reset. No notification clicks that mark read or fixture mutations performed. Preview running session65569; worker remains stopped/drained.
- Installed-schema check and live two-account browser acceptance: **not yet run**. Readiness fallback does not prove live unread/acknowledgment behavior.

## Next checks and limits

1. Separately approve read-only `supabase/diagnostics/20261017_activity_preflight.sql`; all seven booleans must be true. Stop if candidate objects already exist or dependencies are missing. It has not been run.
2. Separately approve persistent local installation of only `supabase/candidates/20261017000100_activity_notifications.sql`, followed by PostgREST schema reload and `node scripts/test-activity-notifications.mjs --applied` (same rollback fixture scope as the passed candidate test). Installation creates new private receipt tables/triggers/APIs and replaces the two follow read APIs; eligible current mentions are copied permanently with their read state. Ordinary historical messages/acceptances are not backfilled. Existing records are retained. No activation implied by test/build approval.
3. Separately scope fixture browser mutations across two accounts: list opening, visible/hidden/background/newer/late replies, acceptance, removal/rejoin and narrow keyboard layout. Keep owner account safe and retain fixtures.

Concurrency races, performance under large Tables and broad device/accessibility acceptance are not proven by source checks. No deployment or release gate is closed by this preparation.
