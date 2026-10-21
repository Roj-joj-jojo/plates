# Plate likes and direct comments

Updated 2026-10-15. Owner approved implementation and separate local activation, including the explicit first-version limits below. **Lint, typecheck, runner syntax, rollback database fixture suite, final production build, activation preflight and installed-schema rollback checks passed.** Candidate 20261015000400 is installed locally and remains outside managed migrations. Browser acceptance is next. App/worker stopped and drained by owner for checks; not restarted. No Git, dependency, physical record deletion, live worker, hosted access or publication.

## Agreed behaviour

- One reversible like per account/Plate; self-likes allowed, count/current-viewer state shown. No liker directory or like notifications.
- Flat plain-text comments, up to 2,000 characters; no replies, photos or mention resolution/notifications. Feed has like/comment counts and a comment link; discussion/composer lives on the Plate page.
- Newest-first 30-row keyset pages; direct notification links resolve a particular older comment separately when it is not in the current page. Refresh/newest/older navigation and removed placeholders included.
- Comment author edits/removes their own comments; Plate author can remove others' comments, never rewrite them. Removal requires confirmation, blanks stored text/hash, retains a “Comment removed” placeholder and has no Undo. UI captures edit/removal revision when opened, preserves drafts during refresh, guards duplicate submissions and reports errors. Idempotent create/edit/remove/like retries cannot resurrect removed text.
- Audience is everyone who can CURRENTLY read the original Plate. This covers counts, lists, deep links and mutations. Menu retention and Table membership do not grant original interaction access. Ordinary commenter account privacy does not hide comments from remaining eligible readers of the Plate; composer explains its audience.
- A new comment by someone else notifies the Plate author once. Own comments, edits, removal and likes do not create alerts. Notifications/bell preserve follows/mentions, recheck source access and hide removed/unpublished/erased context; no comment text snapshot is stored in notifications. No email/push or every-commenter subscription.
- Source-author/account cutoff clears related like identities/state, authored comment text/identity/request fingerprint and notification references; source-Plate erasure also clears the remaining discussion. No direct comments are copied into Menu saves or Table-share threads. Existing recorded-erasure/profile-state hook covers normal cutoff and replay, but independent ledger/physical cleanup is separate.
- Current eligible participants/followers use existing account-update signals. Privacy/unpublish changes prompt prior interacting readers to recheck access. Non-following readers who have never interacted can use Refresh comments; no new public Realtime channel. Previously delivered text cannot be recalled.

## Implementation

Three private RLS tables with no client/service-role table access or physical-delete path. Authenticated-only RPCs provide guarded summaries, likes, comment mutations, paged/single-comment reads and recipient-only notification read/list. Ordered profile/Plate locks serialize privacy, follow and cutoff checks; per-actor advisory locks serialize first-like/create retries. Version checks protect edits/toggles; source read permission is checked before retry success. Readiness gating keeps the pre-activation UI unchanged.

Client/server files: `plate-interactions.tsx`, `plate-comment-notification-list.tsx`, `src/lib/supabase/plate-interactions.ts`, Feed/detail and Notifications/bell integration. Existing Save/Open/share/author controls, private Table threads and frozen Menu content remain separate.

## Passed checks and fixture scope

Owner explicitly approved and agent ran the following from `/Users/roryjohnson/dev/plates`; all passed:

```sh
npm run lint
```

```sh
npm run typecheck
```

```sh
node --check scripts/test-plate-interactions.mjs
```

Owner confirmed app/worker stopped/drained and approved the rollback fixture test, which passed after separately approved Docker escalation:

```sh
node scripts/test-plate-interactions.mjs
```

One rollback-only transaction wraps the candidate plus three synthetic Auth/profile/username accounts, two text-only Plates, one two-member Table/share, one Menu save, two like records and 37 comments/notification records. Simulates fixture commenter/source recorded-erasure cutoffs with structurally valid synthetic receipts. No Storage/image bytes, worker ownership, Auth deletion or cleanup. Candidate/data/setting changes all roll back; no persistent activation. Existing live data is not the fixture target.

Assertions cover authenticated privilege/recipient isolation, open non-following reader/self likes and retries/stale toggles; blank/oversized text; create/edit retry and changed-request refusal; own removal/moderation/no moderator rewrite; removed-text/notification suppression; 30-row keyset/deep link; current private/follow/revoked/unpublished access, Table/Menu separation and commenter/source cutoff. Tests use sequential sessions/transactions and do not establish true simultaneous HTTP races, UI accessibility/draft behaviour or signed independent-ledger persistence.

Owner-approved production build passed compilation, TypeScript, page generation and tracing. Final review changed Refresh comments to call router.refresh explicitly rather than navigating to the same URL; lint and production build were rerun and passed after that focused UI change. SQL and fixture files were unchanged after the passing DB check.

```sh
npm run build -- --webpack
```

Build wrote local `.next` output; no dependency installation or deployment. Read-only activation preflight and installed-schema checks below passed after separate owner approval. Browser and true concurrent transaction acceptance remain pending.

## Local activation — approved and completed

Owner explicitly approved these commands; preflight passed, installation committed, and installed-schema verification passed on 2026-10-15. The commands below are an execution record: do not repeat the absence preflight or reinstall the candidate.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/diagnostics/20261015_plate_interactions_preflight.sql
```

After the read-only absence/privacy/ownership preflight passed:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/candidates/20261015000400_plate_interactions.sql
```

This commits only the interaction schema/functions/hooks. No historical likes/comments/notification backfill or existing content removal. Do not reinstall previous candidates or push all migrations. Candidate must later enter the owner's migration/release process for fresh environments.

Installed-schema verification passed with the same rollback fixture scope; all synthetic records and test changes rolled back:

```sh
node scripts/test-plate-interactions.mjs --applied
```

Initial sandbox attempts could not access Docker; the exact preflight and installed-check commands then passed with approved escalation. Installation also used approved Docker escalation. Activation created no real likes/comments, and neither app nor worker was restarted.

## Browser review after approved activation

2026-10-15: owner reports all five requested browser checks good: Feed/detail like/unlike counts; second-account comment create/edit/own removal; Plate-owner removal without editing others; new-comment author notification opening the correct comment; and private/unapproved/revoked access denial. This is owner-reported acceptance of that checklist, not independent verification of pagination, older-comment links, keyboard/draft behaviour or true concurrency. App was used for review; process state is not independently inspected. Earlier browser-pending statements above are superseded for these five checks.

Owner starts built app with `npm run start`. No photo worker needed for text interactions. Use owner-selected test Plates/accounts to check Feed/detail likes/counts/self-like/unlike, ordinary and private approved readers, commenting/edit/removal/Plate-owner moderation, keyboard dialogs and draft retention while another session updates. Confirm notification count/read/link (including an older comment), no like/self/edit notifications, removed placeholders and page navigation. Keep Menu/Table discussions separate; revoke follower access and unpublish to recheck fresh API/UI/notification denial. Do not erase real accounts for acceptance; fixture cutoff testing is separate. True concurrent races, full restore/erasure, hosted settings/cache expiry and remaining alpha gates stay outstanding unless specifically tested.
