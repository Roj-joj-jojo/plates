# Content controls

Updated 2026-10-11. Owner approved the permissions and retained-conversation model. Candidate and installed rollback SQL, lint, typecheck and runner syntax checks passed under specific approval. Only 20261011000600 was applied locally under separate approval; new controls are enabled for browser review.

## Permissions and behavior

Authors can edit or remove their own Table messages, replies, Request questions/context and share notes. Active Table membership is required. Table Admins can remove content in their own Table, but cannot edit another author's words or unpublish another author's original Plate. Controls use the current Table role rather than app-admission ownership.

The original Plate author can edit the Plate through the existing form or unpublish it with confirmation. Unpublishing clears its original text/links/tags, removes it from available feed/source reads and preserves attribution for the established later erasure workflow. Existing Menu snapshots/previews and Table discussions remain. Removing a share has no effect on the underlying Plate or saved copies.

Table removal clears original text/links and replaces a Request question with a neutral label. Timeline entries, threads, replies, retry fingerprints, media associations and account identities remain structurally intact. UI shows neutral placeholders. Existing replies remain readable and can still be edited/removed by their author or moderated; new replies stop once their Request/share root is unavailable, matching the existing posting guard. No restore or hard-deletion action is introduced.

The shared options menu opens an editor or a confirmation panel. Editors resolve stored mention IDs to visible usernames, preserve attached photos and offer links. Unresolved mentions become a neutral non-mention label to avoid accidentally identifying a different account. Edits/removal capture the viewed update timestamp; a newer edit causes a refresh-required conflict instead of silently overwriting it. Plate unpublish captures its viewed revision. Removal retries recheck permission and return success for an already removed target.

New edits to message/reply text or Request questions receive an explicit Edited timestamp. Earlier Table edits are not backfilled. Existing Plate revision labels include changes to category/tags/photos as well as text. Original posting retry fingerprints stay unchanged.

## Photos and mentions

Ordinary removal hides attached photos and denies new location/signing access through existing availability checks. It retains photo files and associations; it does not run the account-erasure worker. Previously issued image URLs have the existing one-hour expiry and may remain usable until then; downloaded/cached images are unaffected. This is ordinary content removal, not the stronger account-erasure cleanup process.

Removed originals deactivate their mention notifications through existing triggers. Available reply notifications retain discussion links after a root is ordinarily removed, while erased-root behavior remains unchanged. Edits update mention associations through the existing normalization/deduplication triggers. Table-content signals already refresh conversation views; an added Plate-change trigger refreshes its Table shares and savers' source status without changing snapshots.

## Implementation and activation

Candidate: `supabase/candidates/20261011000600_content_controls.sql`, retained outside the migration directory until local application is specifically approved. Adds Edited fields, guarded edit/remove/unpublish functions, an access/readiness function and Plate revision signals. Replaces the Request-question guard while preserving its account-erasure exception; expands only reply notification visibility for ordinarily removed roots. No table/trigger/constraint deletion, direct client UPDATE grant, dependency change or physical Storage/Auth deletion is introduced.

The server uses `content_control_access` to hide new controls while the candidate is absent. Timeline/reply reads use the established explicit security-invoker views; their added Edited field is optional before activation. Available and removed timeline roots render with their existing discussion links.

## Local checks

Run from the project root only with specific owner approval:

```sh
node scripts/test-content-controls.mjs
```

Candidate SQL and synthetic fixtures run inside one transaction and roll back. Checks cover author/Admin/member/outsider boundaries, stale edits/removals, Request question edits, posting retry identity, retained replies/snapshots/photos, removed photo read denial, mention context/cleanup and compatibility with recorded synthetic erasure. There are no actual photo objects, worker starts, Auth deletions or persistent fixtures in this suite.

```sh
npm run lint
```

```sh
npm run typecheck
```

```sh
node --check scripts/test-content-controls.mjs
```

After separately approved application of only this candidate, the installed suite is:

```sh
node scripts/test-content-controls.mjs --applied
```

On 2026-10-11 the owner specifically authorised the four prepared checks above. All passed. The initial database command could not complete in the sandbox; approved Docker-access escalation passed the same rollback-only suite. No synthetic records, candidate schema changes or erasure state were committed. No application fixes were required by these checks.

The owner separately approved retaining/copying only 00600 into migrations, checking it was the sole pending local migration, applying it locally and running installed-schema rollback tests. The local CLI confirmed only 00600 applied; the installed suite passed. Restricted CLI/test runs were blocked by local settings/Docker access; approved escalated retries succeeded. Synthetic fixtures/settings/erasure changes were rolled back, and no existing content, accounts or physical photos were removed.

A fresh build remains unverified; avoid a default production build while dev uses the same `.next` output. General browser acceptance was owner-reported below. Subsequent specifically approved real local concurrency, authenticated route rendering and short photo-URL expiry checks passed; see EDGE_CASES.md for exact evidence and limits. Interactive edge-case clicks and a full one-hour URL expiry wait were not performed. All edge fixtures are retained; nothing is automatically cleaned up.

## Owner browser review and design follow-up

On 2026-10-11 the owner reported the controls work in their browser. Exact tested actions were not enumerated; this is general owner acceptance rather than a claim that every browser removal/unpublish/media case passed. Existing SQL/app checks remain passed; no new agent checks were run.

Design feedback deferred at the owner’s request: the three-dot control and expanded menu take too much space/prominence on a message. During the design stage, make these secondary controls more compact while keeping them discoverable and usable. No layout change has been made for this feedback.
