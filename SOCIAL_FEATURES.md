# Usernames, Table members and live conversation

Updated 2026-10-11. This covers the three owner-requested features before content controls, visual design and hosting. Local only; no Git/deployment or dependency changes.

## Current status

- Fixed usernames/mentions: migration 00300 applied locally with specific approval. Candidate and installed rollback SQL, lint/typecheck/syntax/Webpack build passed. Owner browser test passed suggestions, recipient notification and opening the mentioned content. Subsequent UX changes hide the sender from suggestions and open message mentions within the Table; lint/typecheck passed and owner confirms both work well in Firefox.
- Direct Table membership: 00400 applied locally with specific approval; candidate and installed rollback SQL and app checks passed. Owner browser review passed Admin assignment, immediate promotion controls and ordinary-member separation across three accounts. No existing membership has been changed by the agent.
- Live updates: 00500 copied into migrations and applied locally with specific approval; candidate and installed rollback SQL, lint/typecheck/syntax and Webpack build passed. Separately approved local Auth/RPC/WebSocket acceptance passed actual member/recipient delivery and outsider/former-member denial. Subsequent isolated-browser test passed automatic incoming-message rendering with exact unsent draft and focus retained; no hydration warning on fresh load/live refresh. Owner's reported disabled-button hydration mismatch was not reproduced; its cause remains unconfirmed. Owner reconnect test recovered missed messages, but the unsent draft was lost. Draft recovery is deferred at the owner’s stated low priority; exact test steps/cause remain unconfirmed.

## Usernames and mentions

Existing and new accounts choose a username once after signing in. Core app pages redirect missing usernames to selection; Account also offers the form. Use 3–30 ASCII letters/numbers/underscores beginning with a letter. Casing is stored as entered; a unique lowercase index prevents duplicates. Fixed claims serialize on the active profile lock. Reserved system labels are refused. Display names remain independent and may overlap. No username availability directory or anonymous lookup is introduced.

Messages, replies, share notes and Request context offer Table-member suggestions. The backend matches case-insensitive handles against current members and stores account-linked tokens in body text. Manually forged tokens naming outsiders are refused. Rendering resolves only profiles currently visible to the viewer and falls back to a neutral FormerMember label. A small member card shows display name/username, no email. Request titles and feed Plate text are not mention-enabled.

Suggestions omit the signed-in account, identified through its existing private profile view. Message notifications open the Table at a highlighted message, including an available older message outside the latest 50 entries. Missing/inaccessible message targets show an unavailable notice without widening access. Reply notifications continue to open the exact reply in its discussion. Existing database-generated URLs are adapted by the notification UI; no migration is required.

One notification per source/recipient is retained; retries do not create duplicates. Self-mentions do not notify. Mention edits deactivate obsolete notifications. The Mentions page opens the original message/discussion/reply and records read state. Current Table access is required; departure hides notifications/context. Erasure cutoff clears usernames and sender/recipient notification association, deactivates notifications, and keeps structural records. No email or push notifications.

## Table management

Direct addition supersedes invitation-token/acceptance proposals. Create selects accounts by exact username; Members offers subsequent additions. Added people immediately see full prior conversation. Usernames must already be chosen. Lookup returns only the exact selected active account’s name/username/ID, never email or a browse-all directory.

Admins can appoint/demote Admins and remove others. Members can leave. The last Admin cannot demote or leave without atomically appointing another active member or closing the Table. Closure retains Table/content, ends all memberships/periods and removes access. Rejoins append periods; repeated additions/removals preserve invariants. Profiles lock in ID order before the Table; closure refuses a changed membership snapshot rather than acquiring later profile locks out of order.

## Live updates

Only content-free revision tables are added to the Realtime publication: conversation_updates is readable by current Table members; account_updates only by its active account. No bodies, email, media paths, private notification rows or usernames are replicated by this feature. Signals cover conversation changes, membership/closure, mentions/read state and username selection.

The app batches signals into authenticated route refreshes. Existing server queries and RLS determine visible content. Realtime handles reconnection; visible tabs also check revisions every ten seconds and refresh on return/online recovery. Draft inputs stay mounted during normal live refresh; full browser reload/reopening does not promise draft persistence. Owner also observed draft loss during reconnect, so draft recovery across reconnect is not verified and remains deferred. Removed members receive their own account signal to refresh out of inaccessible Tables. No typing indicator, presence, push or email layer is added. Protocol is based on [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Verification

Firefox reload follow-up: the owner confirmed repeated disabled-button hydration mismatch in Firefox. Message/reply forms now use autocomplete off to prevent its documented dynamic button-state restoration before hydration. Lint/typecheck and isolated-browser form/reload checks passed; direct Firefox control was unavailable, so owner regression confirmation remains pending. This change does not add draft storage across full page reloads.

Owner follow-up on 2026-10-11: Firefox no longer shows the error after its required update (cause unconfirmed). Normal/private Firefox sessions passed automatic message arrival with an unsent draft retained in the background normal window. Mention suggestion/send/recipient notification/opening passed before the two subsequent UX changes; their lint/typecheck passed under specific approval, while browser navigation/highlight, older-message and self-exclusion acceptance remain pending. No new build or database test was run for these frontend changes.

Run only with specific owner permission:

`node scripts/test-social-features.mjs usernames|tables|updates` tests the selected candidate in a transaction. `--applied` tests installed schema. Each synthetic fixture/settings change rolls back; no Auth/Storage deletion, email send or worker. The updates candidate also temporarily changes publication inside that rolled-back transaction: it cannot prove committed WebSocket delivery.

`node --env-file=.env.local scripts/test-local-social-http.mjs --approved-local-fixtures` passed with specific approval on 2026-10-11. Three labelled local accounts with usernames, two labelled Tables (one closed), two messages, one Request/reply, notification read state and scoped membership/Admin transitions were retained. The private scope journal is `/private/tmp/plates-social-http-WrkwP0/scope.jsonl`; preserve these fixtures, with no automatic cleanup. The test admitted only its generated fixture emails through the appointed owner’s guard, created/verified local Auth via admin-generated links without sending mail, and used actual user sessions and WebSocket subscriptions. It verified member/recipient signals and outsider/former-member denial, disconnected only its clients, erased nothing and started no worker. It did not test browser rendering, draft preservation, simultaneous Admin races or actual offline/reconnect UI behavior.

Owner subsequently confirmed both mention UX changes work well in Firefox. This verifies self-exclusion and opening message mentions in the Table; older/missing target cases and reply regression remain unconfirmed in the browser. No new agent-run checks accompanied that owner report.

Owner browser review on 2026-10-11 passed Admin assignment, immediate Admin controls after promotion and no Admin controls for an ordinary member across three accounts. Missed messages appeared after reconnect; the unsent draft did not remain. Owner considers draft recovery low priority, so it is deferred. Exact disconnect/reload steps were not supplied; no diagnosis or fix is claimed. Browser create/add/full-history, demotion/removal/leave/closure and simultaneous Admin races were not separately reported as tested. No new agent checks or account changes accompanied this report.

Content-control follow-up on 2026-10-11: separately approved migration 20261011000600 is applied locally; candidate/installed rollback SQL and lint/typecheck/runner syntax passed. Adds author edit/remove, Table Admin removal, original-author Plate unpublish, retained placeholders/replies/Menu snapshots and edited labels. Browser acceptance is pending. See CONTENT_CONTROLS.md for exact behavior, photo URL limits and verification.

Scoped edge acceptance on 2026-10-11 passed actual concurrent Admin changes/departures/replacement/closure, content edit/remove and Plate unpublish conflicts, retained replies/Menu snapshots, authenticated older/missing/outsider mention rendering, and real photo fresh-signing denial/short URL expiry. See EDGE_CASES.md for evidence, retained fixture scope and limits. No application fixes required; design remains next.
