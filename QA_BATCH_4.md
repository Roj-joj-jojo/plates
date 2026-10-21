# QA Batch 4 — Conversation clarity

17 October 2026. Owner requested this batch and approved lint/typecheck/offline formatting checks, agent-preview stop/build/restart and read-only browser checks in the existing fixture account. Same-session feature-branch confirmation retained. No Git, database activation, worker, uploads, account changes, posting or cleanup.

## Implemented

- Preserved the two audiences: comments on the original Plate follow current original readership; chat/questions/shared-Plate replies follow private Table membership. No content or discussions merged, copied or moved.
- Original discussion is “Comments on this Plate”, with “Comment on the original Plate” composer and explicit audience. Counts say active comments; removed placeholders remain and explanatory text says they are excluded. Existing comment ordering, pagination, linked-comment behavior, edit/remove permissions and text/photo limits unchanged.
- Private reply areas say “Replies in [Table name]”. Their composers say “Reply to this Table” and identify members, including people added later, as the audience. Shared-Plate replies explicitly do not post a comment on the original. Shared original link names its separate comments. Unavailable originals retain their neutral placeholder; Table notes/replies remain independently available under existing access rules.
- “Ask the Table” opens a question with its own replies; primary action says “Post question”. Question page explains saving it to Menu as a Request. Saved Request label/routes/RPCs are retained, avoiding a data-model rename. Some management controls still use the Request domain name.
- Added shared author/avatar/display-name/fixed-username/time/edited presentation across chat, original comments, Table question/share roots, replies and standalone message pages. Table author metadata remains hidden for unavailable contributions. Removed replies/comments do not render author metadata or photo content; removed entries stay in sequence.
- Shared deterministic Europe/London formatting: chronological date dividers at date changes; short visible times with full date/time/timezone in accessible labels/title; full visible dates for standalone roots and linked comments. Ordering still follows existing conversation position/comment paging, not a new timestamp sort. Dates do not use relative Today/Yesterday labels or depend on host timezone.
- Date rows are separate list items without message IDs. Existing IDs, thread-scroll inputs/targets and unseen-message calculation remain message-only. Shared Table reply layout replaces duplicate rendering in question/shared-Plate pages.
- Reply counts in Table cards include available replies only. Detailed reply count says active replies shown, keeping the existing first-100-reply query limit explicit through “shown”; no new pagination or total-count endpoint. Removed rows remain in their positions. Table header singular/plural member/photo text corrected as part of the shared metadata pass.
- Uses existing guarded profile-directory/resolve-mentions/picture-location/signing paths. Comments fetch pictures only for available authors in the current page/linked result. No new directory, public image path, permission, RLS or schema changes.

Files: conversation-ux.ts, conversation-meta.tsx, conversation-people.ts, table-replies.tsx, relevant Table/Plate pages, TableConversation, Plate interactions and existing composers. Offline runner: scripts/test-conversation-ux.mjs.

## Checks passed

```sh
npm run lint
npm run typecheck
node scripts/test-conversation-ux.mjs
npm run build -- --webpack
```

Offline checks cover London day boundaries versus UTC, winter/summer time, repeated hour at the UK autumn clock change, invalid-date fallback and singular/plural wording. Informational Node module-detection warning only; no dependency/package changes. Source checks and final build passed; no source edits after that build. Approved preview restarted with sandbox escalation for loopback, execution session **39824**, 127.0.0.1:3000. Photo worker remains stopped from previous drained run.

## Read-only browser evidence

Existing Social HTTP Peer fixture; no Auth/account or data mutations:

- Fixture Table3631bf7a-7bc1-472f-9817-4035007747ce shows separate 11/17 October dividers, fixed handles beneath display names, short times, full London date/time/timezone accessible labels/title, “1 member · 2 photos” and private chat audience beside composer. Question card links to its Table replies and shows two active replies.
- Existing Question1b2f3827-c575-4aac-862e-1dbdbfbfe29e shows root author/full timestamp, two replies with consistent metadata, separate date dividers, retained photo, named Table audience and existing Save Request action. Own reply menu offers Edit reply/Remove reply; opened/dismissed only. At390px viewport/document width both390; no horizontal overflow. Screenshot captured.
- Existing Edge Content Table565b4220-f6a4-4791-be67-910ddd844563 still shows removed-message placeholder without author/body, and a share whose original is unavailable. Opening shareac717b39-8407-432b-bf17-199a45c943e8 shows Table note, unavailable-original text, zero replies and Table-only composer, without original text/photos. This is one read-only unavailable-original case, not comprehensive privacy/revocation proof.
- Original photo QA Platee1980ff9-97e5-4699-b239-8f7b5fe4da06 shows Comments on this Plate, separate readership explanation, active-count/removed-placeholder note, zero active comments and Refresh fallback. At360px document width360; no horizontal overflow. This Plate has no comments, so populated/removed/linked-comment metadata was not newly browser exercised.
- Existing Hello message ID7caa1f2b-b5f1-4bb1-a6de-ba7ffe4124de navigated via existing Table entry parameter; five message rows remained and target highlight appeared despite date rows. Standalone message page showed matching full timestamp/access description. Initial exact-text lookup did not match the combined mention paragraph; corrected using the observed article text, no app defect established.
- Ask the Table sheet explains question/reply scope and saved Request terminology, with Post question label. Opened/dismissed without submission. Page error-log check returned zero. Viewport reset; temporary tabs remain temporary.

Evidence: `/private/tmp/plates-qa-batch4-table.jpg`, `/private/tmp/plates-qa-batch4-question.jpg`, `/private/tmp/plates-qa-batch4-question-phone.jpg`, `/private/tmp/plates-qa-batch4-original-comments-phone.jpg`.

## Limits and next steps

- Existing live-update signals inspected: Table/account revisions still refresh eligible views; Plate author/approved followers/prior interacting readers are signalled by existing SQL. An unrelated passive public reader is not universally signalled. Refresh comments remains a fallback. No new subscription/polling/schema contract or guarantee of universal live delivery introduced.
- No new posting/edit/removal, two-account privacy/revocation, concurrent arrivals/scroll anchoring, unread markers under live load, large reply histories, signed-URL expiry, physical-device or full screen-reader tests in this read-only pass. Existing limits (latest50 Table entries, first100 replies, paged comments) remain. Further populated/removed-comment and readable-shared-original visual acceptance would strengthen coverage.
- No data/accounts/content deleted or changed, no fixture creation, no worker/recovery/Storage upload/activation, no Git/dependencies/remote action. Normal signed-in image reads/signing used existing app paths.
- Next planned implementation: Batch5 notifications. Owner accepted follow-acceptance/grouped Table activity in principle; envelope-versus-bell split and read-state rules remain proposals to settle before implementation. Batch3 forced slow/timeout and remaining action-feedback checks remain separately recorded; this batch does not close all release gates.
