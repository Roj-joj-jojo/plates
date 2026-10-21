# Local database work

M1 was applied locally on 2026-10-06, confirmed by owner-provided CLI output.
The owner supplied the suite's final PASS marker on the same date, confirming
SQL acceptance checks completed and test fixtures rolled back. HTTP/Auth delivery
and multiple-session concurrency remain untested. The owner confirmed
`prototype-foundation` before these files were created. All commands below are
owner-run, one step at a time, from `/Users/roryjohnson/dev/plates`. No hosted
project, credentials in chat, extra packages or Git commands are required.

M2 in `migrations/20261006000200_plates_timeline.sql` was applied locally on
2026-10-06, confirmed by owner-provided CLI output. Its suite in
`tests/plates_timeline.sql` passed on 2026-10-07, confirmed by the owner's final
PASS marker after correcting a duplicate fixture label. All fixtures rolled back.
M1 regression against M2 also passed on 2026-10-07, confirmed by the owner.

M3 in `migrations/20261007000100_menu_reminders.sql` was applied locally on
2026-10-07, confirmed by owner-provided CLI output. Its suite in
`tests/menu_reminders.sql` passed, and the owner then reran both M1 and M2
suites against M3 successfully. Every suite rolled back its fixtures.

The app has local email-code sign-in, Account protection and a connected
text/link Plate → Table → reply → Menu loop. Local email templates contain
`{{ .Token }}`. Docker output confirms published ports remained on IPv4/IPv6
loopback. Browser sign-in/sign-out and the full one-account loop passed on
2026-10-08. `tests/local_auth_http.mjs` passed local Auth and anonymous access;
`tests/local_populated_http.mjs` passed owner/non-member HTTP access with two
synthetic local accounts. That second test creates lasting local records and
must not be repeated casually. Second-member and concurrent-session access
remain untested. No new database migration was needed for this app step.

## Formal Table Requests (applied locally 2026-10-08)

`migrations/20261008000200_table_requests.sql` adds a `request` root to the
existing private Table timeline and threads. A Request has a distinct question,
optional supporting context and the same reply system as Plate discussions.
It also adds one live Menu reference per saver and Request. Menu resolves the
Table, asker and question under the viewer's current membership; after access
ends, only an unavailable-source message is shown. It does not copy answers.

With the owner's specific approval, the migration replaced only
`timeline_entries_kind_check` and `threads_root_kind_check` with wider checks.
It did not delete records, reset the local database or enable removal.
`tests/table_requests.sql` passed as a rollback-only acceptance suite covering
root/thread integrity, idempotent posting and saving, member replies, outsider
denial and direct-write denial. The M2 and M3 rollback-only suites passed again
after application. `tests/local_requests_http.mjs` passed with real local Auth
sessions, Request posting/retry/reply/save, private access, rendered pages and
non-member denial. That HTTP test left two labelled local synthetic accounts
and one Table/Request/reply/save fixture; no cleanup was attempted.

The connected UI adds a Request form to a Table, a dedicated Request discussion,
and saved Request cards in Menu. Feed Requests, selected answers,
Request editing and removal remain outside this slice.

## Initial search (applied locally 2026-10-08)

`migrations/20261008000300_search.sql` adds three read-only, caller-rights
functions: `search_plates`, `search_table` for one chosen Table, and
`search_menu`. They use literal, case-insensitive terms (1–100 characters),
existing content/labels/tags/links, and the same RLS access as ordinary reads.
The first 50 recent matches are shown. Search has no separate index or external
service. Saved Plate search uses its frozen wording; a saved Request is matched
against its live discussion only while the saver has current Table access.

The rollback-only `tests/search.sql` suite passed author/tag/link, Table/reply,
Menu snapshot, selected-Table and anonymous/non-member cases. The real-session
`tests/local_search_http.mjs` check passed accessible results, private denial
and rendered search pages. It reused synthetic local accounts and created only
fresh local sign-in emails, no new content records. Search cannot inspect images
or the content of an untagged photo; Table image browsing needs the media
upload/delivery work first.

## Photo Plate Menu previews (applied locally)

`migrations/20261009000400_menu_photo_previews.sql` adds a private
`menu-previews` bucket, saver-owned preview jobs/assets, and a preview reference
on each frozen Plate save. The existing local media worker derives a 640 px WebP
from the first processed Plate photo. First saves check the saver, Plate, first
photo and revision; repeat saves and source links keep the original snapshot.
Only the saver can sign or read a preview after it is attached to a Menu save.
No cleanup, unsave, erasure, hosted project or dependency change is included.

The migration applied locally with the owner's approval. The proposed migration
and existing M3 suite passed rollback-only tests before application; the preview
suite passed again against the applied schema. The processor check, lint,
typecheck and Webpack build passed before application. After restarting the
worker, `tests/local_menu_photo_http.mjs` passed real local Auth, worker, private
Storage, rendered Menu and frozen-copy checks. It left labelled synthetic local
accounts and Plate/save fixtures. The owner browser save check remains pending.
Do not reset the database or contact a hosted project.

## Table message and reply photos (applied locally)

`migrations/20261009000500_table_images.sql` was approved and applied locally. It adds private Table staging and
served buckets, Table-scoped upload intents/assets, and up to four photos on a
message or reply. Photo-only content is supported. Only current Table members
can request or attach these photos and read an attached photo or its path.
The Plate and Table upload endpoints share the existing per-account attempt
limits; failed attempts count. The local worker was restarted after the
migration to process Table photos. No object cleanup or hosted action is enabled.

The migration and `tests/table_images.sql` passed together in a rollback-only
local transaction. Existing M2, Table Request and M3 suites also passed against
the proposed schema in rollback-only transactions. The Table-photo SQL suite
passed again against the applied schema, including a shared upload-quota check.
Lint, typecheck, script syntax and Webpack build passed before application.
`tests/local_table_images_http.mjs` passed real local Auth, worker, Storage and
rendered Table/message/discussion/Images pages; non-members could not locate or
read Table photos. It left labelled synthetic local accounts, a Table, Plate,
message and reply. The owner confirmed photo-only messages, photo replies and
Browse images work as intended in the browser.

## What M1 adds

`migrations/20261006000100_identity_membership.sql` adds profiles, private Auth
links, Tables (`groups`), current memberships and membership periods. It requires
an empty Auth user table and fails rather than backfilling existing users. It
creates a dedicated `private` schema and fails if that schema already exists;
review the conflict instead of dropping or overwriting anything.

Signup creates an active profile and private link in the same Auth transaction.
The required `raw_user_meta_data.display_name` must be a string that trims to
1–80 characters without control characters. Other metadata cannot grant IDs,
roles or membership. Missing/invalid names intentionally reject signup, including
manual Auth-user creation without that metadata. Updating Auth metadata later
does not silently update the app profile. The application signup UI is not wired
yet; email-code delivery still needs an end-to-end test.

Authenticated callers can use `create_group(p_name)` and
`update_display_name(p_display_name)`. The caller comes from verified Auth claims,
never a caller-supplied profile ID. Table creation adds the owner membership and
first open period atomically. Direct table writes are denied, profile state and
Table counters are not selectable, and Auth mappings have no client table grants.
The profile directory view uses invoker security and the same underlying RLS.

Membership periods have immutable identity/start times, cannot overlap or reopen
after closure, and must match current membership state. Available Tables must
retain an active owner. Transition writers must lock profiles in ID order and
then the Table FOR UPDATE before membership/period DML. Parent-guard triggers and
deferred checks also protect privileged fixture writes; future operations must
still follow the documented total lock order.

There are no invitation, joining, leave/removal, owner-transfer, archive, erasure,
Plate or media endpoints in M1. Invitation records and lifecycle operations need
their later designs. Hard deletion of M1 structural records is explicitly blocked
until a reviewed lifecycle migration supplies the necessary workflow. In
particular, an Auth user cannot be deleted while its private link exists.
This migration does not implement erasure or make the app ready for real users.

## Apply locally

Local runtime prerequisites are complete: Supabase CLI 2.120.0, PostgreSQL 17.11,
and Docker host ports verified on IPv4/IPv6 loopback. For future startup use:

```sh
./node_modules/.bin/supabase start --network-id plates-local
```

Keep Docker Desktop's Port binding behavior at **Localhost by default**. The
custom network alone did not restrict ports in this environment. Startup output
contains credentials; share only success/errors with sensitive values omitted.

For reference, the owner applied M1 to the local database using:

```sh
./node_modules/.bin/supabase migration up --local
```

This changes local schema, grants, policies and Auth signup behaviour and records
the migration in Supabase's migration history. It does not reset data or apply
anything to a hosted project. The migration is additive and wrapped in a
transaction. Review errors before proceeding; do not delete an existing schema,
user or volume to get past a precondition. Do not use `db reset`, `db push`,
`--linked` or `--no-backup` as substitutes.

## Validate after application succeeds

Run the acceptance SQL using the existing PostgreSQL client inside the local
database container. This avoids installing a test framework or a host client:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/identity_membership.sql
```

`-i` passes the file into the container; `-X` ignores any psql startup customisation;
`-f -` reads SQL from that input; `ON_ERROR_STOP=1` stops on the first unexpected
error. The container name identifies the local project. No password is printed.

Tests create labelled synthetic Auth/profile/Table fixtures in one transaction,
switch to actual `authenticated` and `anon` database roles for access checks, force
deferred constraints before checking outcomes, and finally roll everything back.
They never commit fixture data or send email. An unexpected error closes the
connection and rolls back the transaction. Existing unrelated data is not edited;
if a reserved fixture UUID already exists, setup fails rather than overwriting it.
The final expected line is:

```text
PASS: M1 SQL acceptance checks completed; all fixtures rolled back
```

Coverage includes valid/invalid signup and rollback, untrusted metadata, separate
app/Auth IDs, hidden columns/private links, direct-write denial, own-name updates,
Table creation, member/non-member/former-member reads, disabled/anonymous callers,
invoker-view RLS, deferred identity/period/owner consistency, duplicate/overlapping
periods, leave/rejoin history and an atomic privileged owner-transfer fixture.

These SQL role tests simulate already-verified JWT claims. They do not validate
HTTP JWT verification, PostgREST response shape, email signup, multiple-session
concurrency, app integration, or later media/lifecycle behaviour. Those remain
separate checks before their dependent features are connected. No test is claimed
passed until its output has been reviewed.

### Local populated HTTP check

`tests/local_populated_http.mjs` uses the project-root `.env.local` publishable
key and refuses a non-loopback Supabase URL. Run it only with local Supabase and
Mailpit active, from the project root:

```sh
node --env-file=.env.local supabase/tests/local_populated_http.mjs
```

It creates two synthetic local Auth users and one lasting Plate, Table, share,
reply and Menu save. It verifies owner writes, exact discussion source, share
retry identity, live Plate edit versus frozen save, and non-member read/write
denials over HTTP. Local codes and tokens remain in memory and output contains
PASS/failure labels only. There is no cleanup; each rerun creates more records.
The agent ran it once with the owner's local-only permission on 2026-10-08 and
all four PASS stages completed. It does not test a second Table member or
concurrent sessions.

### Author identity projection for Plate editing

`migrations/20261008000100_my_profile.sql` adds only a `my_profile` view. It
uses invoker security, existing profile read policy and an explicit
authenticated-only grant to return the caller's app profile ID and name. The
connected editor uses the ID to show its control only to the Plate author;
the existing `edit_plate` function still enforces authorship and revision on
every write. Review the migration, then apply it locally from the project root:

```sh
./node_modules/.bin/supabase migration up --local
```

This records an additive local schema change and does not reset records. After
successful application, run the rollback-only acceptance suite from the project
root (using Docker Desktop's bundled executable on this machine):

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/my_profile.sql
```

Expect `PASS: my_profile identity projection; all fixtures rolled back`. The
suite checks caller isolation, anonymous denial and invoker security; it creates
no lasting records. Review an error rather than resetting or reapplying prior
migrations. The view was applied locally on 2026-10-08 and the suite's final
PASS marker confirmed that all fixtures rolled back. The editor is now
connected. A separate local-only check, `tests/local_plate_editor_http.mjs`,
reused the two synthetic accounts to confirm the author sees the rendered edit
form and a signed-in non-author does not. It creates fresh local code
emails/sessions but no new content fixtures; this check passed on 2026-10-08.
The owner also confirmed interactive edit submission, the `Edited since shared`
marker and the unchanged Menu snapshot in the local browser.

### Concurrent local HTTP retries

`tests/local_concurrency_http.mjs` reuses one synthetic local account, reads a
fresh code through local Mailpit and creates one lasting synthetic Plate, Table,
share, reply and Menu save. Run it only against local Supabase from the project
root:

```sh
node --env-file=.env.local supabase/tests/local_concurrency_http.mjs
```

Eight simultaneous identical HTTP requests for each share, reply and save
must result in one entry/thread, one reply and one reminder/source. The agent
ran it once with local-only permission on 2026-10-08 and all four PASS markers
appeared. Each rerun creates more local records; no cleanup is implemented.
This tests distinct HTTP requests under one Auth session. It does not test
different-member or different-session races.

## M2 — Plates, Table messages and replies

The additive M2 migration creates categories, Plates, timeline entries, share
details, threads and replies. Meal means what you ate; Recipe means how to make
it; Place means where to go. Exactly one category is required, with optional tags.
Publishing a Recipe after a Meal creates a separate Plate; no copy/promotion UI
or automatic association is introduced.

This slice accepts text and links. Empty content is rejected, except for optional
share introductions. Non-empty attachment arguments are explicitly rejected until
M4 implements ready assets, audience checks and image processing. The deferred
content validator must then be extended to include valid media and run on
attachment/asset changes; image-only publishing is not available in M2.

All mutation functions derive the author from the active signed-in caller. Their
responses contain only the resulting UUID, or the revision for a Plate edit.
Safe reads use explicit base-table columns or the invoker views `timeline_content`
and `reply_content`; do not request `*` on metadata-bearing base tables.

| Operation | Arguments (after required IDs, defaults are shown) | Result |
| --- | --- | --- |
| `publish_plate` | `p_category_id`, `p_body = ''`, `p_links = []`, `p_tags = []`, `p_attachment_ids = {}` | New Plate UUID |
| `edit_plate` | `p_plate_id`, `p_expected_revision`, `p_category_id`, `p_body`, `p_links = []`, `p_tags = []`, `p_attachment_ids = {}` | Current revision |
| `post_message` | `p_group_id`, `p_client_request_id`, `p_body = ''`, `p_links = []`, `p_attachment_ids = {}` | Entry UUID |
| `share_plate` | `p_group_id`, `p_plate_id`, `p_client_request_id`, `p_body = ''`, `p_links = []`, `p_attachment_ids = {}` | Share entry UUID |
| `reply_to_thread` | `p_thread_id`, `p_client_request_id`, `p_body = ''`, `p_links = []`, `p_attachment_ids = {}` | Reply UUID |
| `edit_timeline_entry` | `p_entry_id`, `p_body`, `p_links = []`, `p_attachment_ids = {}` | Entry UUID |
| `edit_thread_reply` | `p_reply_id`, `p_body`, `p_links = []`, `p_attachment_ids = {}` | Reply UUID |

Links/tags are JSON arrays; attachment IDs are a PostgreSQL UUID array. Supplied
arrays must not be null; body is preserved as supplied and must not be null.
Edits replace the specified content fields. Plate edits require the displayed
revision and return SQLSTATE `40001` on a stale revision: refresh before retrying
that edit. A no-op Plate edit retains its revision. Entry/reply edits use the
documented parent locks; they do not currently have a stale-edit version field.

Timeline/reply retries use required client UUIDs plus a server-computed SHA-256
fingerprint of the versioned canonical JSON payload. Body text and ordered links
are preserved exactly; changing either changes the fingerprint. The fingerprint
does not include a Plate's current revision, so an otherwise identical share
retry after a Plate edit returns the original share. A reused key with different
input returns `23505`; genuine new contributions use new IDs. Membership is
rechecked on retries, and shares require the original Plate to remain available.
Editing a contribution preserves its initial fingerprint: an original retry
returns its existing ID without undoing that edit. Publishing a Plate has no
retry key in the agreed M2 contract; clients must not automatically retry an
uncertain publish as though it were a message.

An append locks actor profile S then group U, and Plate S for a share. A reply
locks actor profile S, group S, then thread U. Counter increments and inserts
share one transaction; rollback restores both. Reads use returned positions as
cursors. Same-Plate repeat shares have separate threads. Structural IDs, authors,
positions, request identities and original share revisions cannot be reassigned.
Future privileged lifecycle/fixture operations must obey the full lock plan
before DML; direct client writes are denied. Multiple-session races remain untested.

Bodies allow at most 20,000 characters; links at most 10 × 2,048 characters.
URL validation checks HTTP(S) scheme, authority/host/port, credentials, whitespace,
controls and percent escapes without fetching links. DNS/punycode, IPv4 and
bracketed IPv6 hosts are supported. Unicode hostnames must arrive as punycode;
Unicode paths are supported. This is a deliberately bounded database URL parser,
not a full browser URL implementation. The future app should serialise URLs
before submitting them and render text safely. Tags are trimmed, whitespace
collapsed, NFC-normalised, lowercased and deduplicated in first-occurrence order;
at most 10 distinct tags of 40 characters are stored.

No unpublish/erase/delete endpoint is enabled. Unavailable Plates are hidden;
existing share structures and discussions remain. New replies can still be added
after the Plate is unpublished, provided the share root remains available and
the caller is an active member. If a future operation removes an entry/reply,
its body/links must be blank so readable tombstones do not expose removed text.
M6 must replace attribution/fingerprint guards as part of reviewed erasure.

### Apply and validate M2

From the project root, apply the one pending migration:

```sh
./node_modules/.bin/supabase migration up --local
```

Expected: migration `20261006000200_plates_timeline.sql` applied and local database
up to date. It creates new records/functions/policies and the three categories;
it does not reset data or alter the applied M1 migration. Review output first.

After successful application, run the M2 transaction-only acceptance suite:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/plates_timeline.sql
```

Expected final marker:

```text
PASS: M2 SQL acceptance checks completed; all fixtures rolled back
```

The flags have the same meaning as the M1 command above. Fixtures use generated
UUIDs and no emails/sessions. Tests cover limits/URL/tag handling, publishing and
editing, repeat shares, same/changed-payload retries including replies, hidden
metadata, client write denial, member/non-member/former-member access, disabled
and anonymous callers, deferred content/root constraints, immutable positions,
cross-Table reply rejection, counter rollback and retained discussions.

Rerun the M1 suite after M2 passes because the new migration shares existing
identity/permission helpers. These suites simulate trusted Auth claims; they
do not test HTTP/JWT validation, email delivery, concurrent sessions, Storage,
UI integration or Menu saves. Those checks and later migrations remain ahead.

Implementation references: [PostgreSQL string functions](https://www.postgresql.org/docs/17/functions-string.html)
and [built-in SHA-256](https://www.postgresql.org/docs/17/functions-binarystring.html).

## M3 — saved Menu reminders

The additive migration creates `menu_plate_saves` and `menu_plate_sources`, plus
the invoker view `menu_source_context`. A reminder belongs to exactly one saver.
It captures Plate text, links, tags, category ID/label, original author ID/name,
revision and save time. Reading it does not join back to live content or live
author/category labels. Ordinary edits, renames and unpublishing cannot refresh
that copy. Full erasure remains an M6 requirement and must override retention.

| Operation | Arguments | Result |
| --- | --- | --- |
| `save_plate` | `p_plate_id`, `p_expected_revision`, optional `p_source_share_id = null`, optional `p_preview_asset_id = null` | New or existing save UUID |
| `add_menu_source` | `p_save_id`, `p_source_share_id` | Existing save UUID |

A first save requires the revision the caller displayed. If that Plate changed,
SQLSTATE `40001` asks the caller to refresh; no partial reminder/source is left.
Repeated saves return the existing reminder and ignore that first-save revision
check. No supplied author or snapshot fields are accepted. Uniqueness on
saver/Plate prevents duplicate reminders. Conflict handling inserts nothing and
reads the winning reminder in a fresh statement; it never updates the snapshot.

An optional source is an explicit request to retain that discussion. Both
operations require ownership, current source membership, an available share
root, and the same Plate. Composite foreign keys independently enforce the
same-Plate relationship. Repeat sources preserve the original added time.
Simply viewing a discussion adds nothing. New source attachments to unpublished
Plates are not enabled in this slice; existing source-free repeats and retained
reminders still work after ordinary unpublish. Detailed removal eligibility is
left to the lifecycle work, as recorded in the design.

Saved sources store only identifiers and added time. `menu_source_context` uses
invoker joins through existing RLS. After leaving a Table, the owner still sees
their source reference, with `source_available = false` and null group, sharer,
introduction and thread fields. Other users cannot see even that reference.
Rejoining restores the resolved context under the full-history rule. Unpublishing
the original Plate does not erase an otherwise accessible Table discussion.

First saves acquire saver/original-author profile SHARE guards in UUID order,
then optional source-group SHARE, Plate SHARE, category SHARE and existing
reminder UPDATE locks. Author discovery is revalidated under the Plate guard.
Source additions acquire saver SHARE, source group SHARE, Plate SHARE and reminder
UPDATE. Guards remain held until the transaction ends. Category/profile edits
therefore cannot change the labels midway through capture. These operations
target READ COMMITTED; true multi-session contention remains untested.

M3 is text/link only. Non-null preview IDs are rejected, and no preview table or
Storage policy is created. M4 must extend first-save capture/validation and the
deferred reminder-content check before allowing image-only Plates. No unsave,
source-removal, erasure or hard-delete capability is exposed. Existing immutable
snapshot guards must be deliberately revised with the authorised erasure design.

### Applied M3 validation commands (for reference)

From `/Users/roryjohnson/dev/plates`, the owner applied the local migration:

```sh
./node_modules/.bin/supabase migration up --local
```

Confirmed: `20261007000100_menu_reminders.sql` applied and local database up to
date. It adds schema and permissions without resetting data or rewriting M1/M2.
The owner then ran the M3 suite:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/menu_reminders.sql
```

Expected final marker:

```text
PASS: M3 SQL acceptance checks completed; all fixtures rolled back
```

As before, the command stops on unexpected errors and its fixtures roll back.
It creates no emails or sessions. Tests cover frozen content/labels/times, separate
savers, repeated saves/sources, stale first saves, atomic rollback, same-Plate
foreign keys, direct-write denial, invoker-view isolation, departure/rejoin and
unpublish retention. Category label changes are also transaction-local fixtures.
After M3 passed, the owner reran both M1 and M2 suites using their commands above;
both final PASS markers were supplied on 2026-10-07.

These are SQL-role tests, not HTTP/Auth, concurrency, UI or media validation.
The save-conflict implementation follows PostgreSQL's
[READ COMMITTED conflict behaviour](https://www.postgresql.org/docs/17/transaction-iso.html)
and [INSERT conflict handling](https://www.postgresql.org/docs/17/sql-insert.html);
the competing-session paths still require their own tests.

## Plate photo first slice (M4a, applied locally)

The reviewed migration is `migrations/20261009000100_plate_images.sql`. It adds
two private local Storage buckets (`staged-assets`, `plate-media`), upload intents,
ready image records, Plate attachments, and guarded Plate image delivery. It
replaces the existing publish/edit functions with image-aware versions while
preserving text/link calls. It does not remove records or Storage objects.
The owner approved local application on 2026-10-09. The migration applied
successfully. The rollback-only media SQL test and existing M2/M3 regressions
passed; a real local Storage/HTTP check passed after application.

When running the app locally, start the media worker in its own terminal from
the project folder:

```sh
npm run media:worker
```

It reads the service key directly from the running **local** Supabase CLI and
refuses non-local app URLs; no key needs to be copied into `.env.local`. Keep the
worker running while trying photo uploads in the app. The local HTTP check is:

```sh
node --env-file=.env.local supabase/tests/local_plate_image_http.mjs
```

This check creates a synthetic local Plate, Table and image and leaves them in
place. Do not run it against a hosted project. It passed for staged upload,
private bucket access, signed delivery, rendered Plate photo, Table gallery and
outsider denial. Saved photo previews and Table-native message/reply images are
not included in M4a. A separately approved and applied local follow-up,
`migrations/20261009000200_photo_menu_save_gate.sql`, prevents first Menu saves
of photo Plates until previews exist; its rollback-only SQL check passed while
text saves remained available.

### Local upload rate limits

`migrations/20261009000300_upload_rate_limits.sql` was approved and applied locally.
It changes only the upload-intent function: each signed-in account may request
up to 12 photos per rolling hour and 60 per rolling day, with no more than 6
unfinished attempts from the last hour. Completed and failed attempts still
count toward the hourly and daily caps. A per-account transaction lock keeps
concurrent requests from exceeding the caps. The rollback-only SQL suite and a
burst of concurrent requests from a synthetic local account passed. The burst
left pending local test intents in that synthetic account; no cleanup ran.
