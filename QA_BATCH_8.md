# Batch 8 — integrated rehearsal

## 21 October 2026: scoped resilience continuation — completed with limits

This entry supersedes the interruption/pending state below. Owner confirmed Docker was restarted before returning. Continued the same retained run/fixtures; never reran setup/core or created replacement accounts. Original combined scope approved, plus explicit permission for **one additional scoped synthetic photo job** after the browser retry timed out during interruption. General photo worker remained stopped; no old queued jobs processed.

### Browser results

- In a temporary Firefox private window, Reader's accepted-follow alert arrived live, remained unread after reload, then Mark as read cleared the badge and reload retained Read. A later second acceptance was legitimate because the access test revoked/restored this test relationship; not evidence of duplicate delivery. Proof `/private/tmp/plates-qa8-acceptance-read.jpg`.
- Kept Reader's question tab backgrounded while Author posted reply `834fed19-0438-4f41-a71a-e76f762cd91a`. Activity increased from2 to3 unread updates; reload preserved3. Opening the exact new reply left2 unrelated updates unread. Proof `/private/tmp/plates-qa8-background-reply-read.jpg`. This exercises a genuinely unselected browser tab, not a simulated visibility flag.
- Per-test-tab Firefox Offline: submitting `QA8 Resilience — offline retry` showed the actionable retained-draft error and left one reply. Restored No Throttling; one retry cleared the composer and produced exactly two replies. Reload retained one copy of that text, reply `abaa4e20-0c83-4eb6-9165-0704fcf17762`. Developer tools closed after network restoration. Proofs `/private/tmp/plates-qa8-offline-draft.jpg`, `/private/tmp/plates-qa8-online-retry-success.jpg`. Intentional offline request errors are expected, not a zero-error-console claim.
- Signed out only private-window Reader and signed in Author using that synthetic account's local Mailpit code. Account menu showed the correct new identity; no stale Reader identity. Owner's normal Firefox sign-in untouched. No credentials/codes retained in results.
- Author selected only synthetic `table.png`, text `QA8 Resilience — delayed photo recovery`. With no worker, controls disabled during processing; after approximately60s the worker-timeout message appeared. Draft/photo survived, Post reply re-enabled and count stayed2. Proof `/private/tmp/plates-qa8-photo-timeout.jpg`.
- Processed the exact first delayed job; a subsequent browser retry also timed out across the interruption. Four-job original budget exhausted: no implicit extra upload. Owner explicitly approved the fifth job. Updated internal runner to allow only this run's single fifth Table job, leaving ordinary four-job budget unchanged. Started runner before clicking the final retry, immediately processed the new job, observed Reply posted, empty composer/selection and3 active replies. Reload persisted those results. Separate Peer browser loaded the photo at480×640 and saw3 replies. Photo reply `f5b64fbf-4be5-4374-890f-4424d2141c11`; read-only REST confirmed exactly3 replies and exactly one recovery text. Proof `/private/tmp/plates-qa8-photo-retry-peer-full.jpg` (also native `/private/tmp/plates-qa8-photo-retry-success.jpg`).

### Real API/Storage results

- Current pending/private Plate/media denial, anonymous Plate denial and outsider Table/reply denial passed in core. Real committed message with a simulated lost acknowledgment retried to the same single record. Scoped transport timeout/delay also passed; distinguished from actual browser Offline above.
- Introduced Reader mention, changed it to Peer and removed it from only the new message: Reader's mention count dropped as expected. This is API evidence, not full browser acceptance of every edited-mention/read race.
- Reader saved one derived-photo Menu copy and made one comment. Revoking only this new follow denied Plate/comment reads, image-location access and new Storage signing; outsider signing denied. Reader's Menu save row remained. Already-issued photo URL still delivered before expiry, as expected.
- Author open→Outsider Plate REST visible; Author private→hidden; Reader follow request/approval restored. New Table Reader removal denied timeline/reply REST and members RPC; re-add restored membership access. Only new fixtures/settings/relationships affected.
- Waited the actual300-second signed photo URL lifetime: old URL refused after expiry; currently authorised Reader obtained a fresh working URL. This verifies real Storage expiry/new signing at the app's300s lifetime, **not browser automatic image-URL renewal**.
- Runner acceptance label says “only the requesting Reader”; assertion establishes Reader received it. Do not infer a separately verified Outsider notification absence from that label.

### Final retained scope and operations

Same run/private manifest `/private/tmp/plates-qa8-resilience-Vqn2vg`, project pointer `QA_BATCH_8_RESILIENCE_RUN.json`. Final counts **3 accounts,1 Table,1 Plate,1 question,2 messages,3 replies,1 comment,1 Menu save,5 photo jobs**. Existing fixture IDs below remain valid. Final Author private, Reader follow approved and Table membership restored; optional Peer remains member of the new Table only. All fixtures/files/objects retained, including ready assets from timed-out uploads that were not attached to a reply. No cleanup authorised.

Scoped jobs: Plate `760793d3-32ce-4f44-8dcf-9e67865c8494`; Menu preview `5b35b5d0-b6da-4512-a29c-ada04107dcfe`; Table attempts `416342db-d846-4509-9f7a-f845348fd155`, `1b8425e2-562e-49a0-b968-3a1da6cbed81`, final `2bd1b711-5ee4-4282-b02a-ed1f6edf5153`. Each scoped worker completed and released ownership; final owned run `fb2d87fd-fbb2-4396-bb26-cb2b3a140c0d`. No unrestricted polling or old-job recovery.

Internal `scripts/qa8-resilience.mjs` final self-test, syntax and focused lint passed. Reviewed continuation only regenerates ephemeral sessions for these existing accounts, checks prior session-finished/expiry evidence and reconciles replies; no new setup. Fifth-job entry point restricted to this run and exactly four prior jobs. Final inspect reconciled actual browser reply count3 into manifest. Runner32011 recorded session-finished and was terminated after all worker ownership drained; older72076/14746 similarly finished. Temporary Firefox private window closed; owner window retained. App preview63908 left running; owner Docker not restarted/stopped by agent. No app source change/full build required. No Git, dependencies, schema activation, deletion, remote or publishing actions.

These targeted local cases are complete. Exhaustive notification/concurrency races, every HTTP endpoint/form combination, browser automatic URL renewal, real devices and deferred accessibility/mobile work are not newly certified. Hosting/release email delivery, deployed worker, backup/restore and migration integration remain a separate phase. Preserve previous passes rather than reopening whole signup/privacy/photo journeys.

## 21 October 2026: interrupted resilience run reconciled

Owner explicitly approved `QA_BATCH_8_REMAINING_SCOPE.md`. Prepared internal runner `scripts/qa8-resilience.mjs`; local-origin/budget/foreign-job refusal checks, syntax and focused lint passed initially. Review fixed a Plate RPC parameter before live setup. Initial live command was sandbox-refused before fixture creation; separately approved escalation reached local Supabase.

First setup created exactly3 synthetic accounts and1 labelled Table, then failed at the runner's incorrect question parameter (`p_body` instead of `p_context`). Inspected retained manifest: no question/photo job existed. Corrected runner and added a narrowly guarded reviewed continuation using the same accounts/empty Table; no replacement accounts/Table created. Syntax passed; focused lint had0 errors/1 unused-variable warning. No application defect inferred from these test-runner mistakes.

Retained scope `/private/tmp/plates-qa8-resilience-Vqn2vg`, project pointer `QA_BATCH_8_RESILIENCE_RUN.json` (do not delete/reset/re-run fresh setup). Actual IDs:

- Author2af9a6a2-c2d6-457a-b966-fef12676e3b2, Reader17c6d510-41c7-483a-a5f8-07e0a2832531, Outsider2959ee99-4821-40d1-bc92-8711f82f026f.
- New Table5b149ca4-e1b0-4840-b5bc-c401c239f705 includes new Author/Reader and existing Peer only. New question62098433-8487-4b42-91d9-0b38212abddb. New private photo Platee509be22-27aa-4fbc-b55a-795cc1ae0399.
- Only Plate job760793d3-32ce-4f44-8dcf-9e67865c8494 was processed; owned run0fb23aaa-f3d8-4335-ad59-d8db74fae30f completed1/rejected0 and closed ownership successfully. No unrestricted worker or old queued job processing. New Reader follow request remains pending.

On resuming after session limits, recovered exec cell238/runner72076 output and manifest. Core tests completed:

- Real authenticated REST: pending/private Plate/media and outsider Table/reply denial; anonymous Plate denial.
- One real committed message with simulated lost response; repeated same-request retry returned the same ID/one row.
- Scoped test-client timeout/delay and retry passed; **not browser offline/draft verification**.
- Introduced Reader mention, changed to existing Peer, then removed mention from only the new test message. Reader mention count dropped as expected. No browser recipient-read acceptance claim from this API check.

Runner72076 remains alive, idle awaiting commands; do not send core again (one-run guard). App preview63908 also alive. Its accumulated output contained destination-stream errors and App access settings unavailable. Owner explains Docker was closed during the session interruption to reduce RAM usage; no agent restart of Docker. Fresh current IAB reload succeeded and captured error log empty. Historical server errors are not claimed as a current app defect. No service restart, new fixture mutation or worker start performed during the status check. General continuous worker is not running under this rehearsal.

Pending within approved bounds: browser offline/timeout/draft/retry, isolated Auth sessions/follow-acceptance notification, background receipts, delayed Table-photo UI job/retry, Menu preview/save/revocation/300-second expiry and membership revoke/re-add. Core results do not close those cases. Continue only with the existing run/session and manifest; if sessions are lost, review a targeted continuation before any mutation. Docker/backend availability is a prerequisite, not permission to silently restart owner-stopped services.

## 20 October 2026: populated comment paging and late replies — passed

Owner explicitly approved31 numbered comments on existing QA Batch3 Plate and one new labelled question with102 numbered text replies in existing Social HTTP Table. All created through normal signed-in peer browser controls; no direct SQL/API fixture seeding or uploads. Records retained as approved.

### Plate comments

- Plate `1361c2f4-26e5-4dac-98d1-8038720bac9f` initially had zero comments. Created exactly **QA Batch 8 pagination comment 01–31**, checking each visible success before continuing. Comment01 submitted with Cmd+Enter,02 with Ctrl+Enter, remainder by button. Composer reset and counts settled correctly.
- Newest page had30 unique rows,31→02; total active count31. Older comments showed only01; Newest comments returned30 rows. No overlap/missing row at the tested boundary.
- Oldest comment ID `1a12b742-fc7a-43ff-b625-f3ff44ae8abb`; newest `0e42ccb5-ab5c-45a6-839f-18ef3491c5ba`. Source-defined direct route `?comment=ID#comment-ID` loaded oldest separately under Linked comment alongside newest30 (31 unique comment IDs), scrolled target into view (top24/bottom224px). This exercises the older-comment deep-link path; no notification was generated/marked by self-comments.
- Evidence `/private/tmp/plates-batch8-linked-comment.jpg`.

### Table question/replies

- In Table `3631bf7a-7bc1-472f-9817-4035007747ce`, created question **QA Batch 8 — reply boundary rehearsal 20 Oct**, ID `e88a16e0-44c7-49d0-bf4b-4a83f9c9f097`, supporting context Numbered synthetic replies for testing the first-100 boundary. Question submission via Cmd+Enter passed.
- Added exactly **QA Batch 8 boundary reply 001–102**.001 submitted with Cmd+Enter,002 with Ctrl+Enter, others by button. Replies001–100 each checked in rendered content with recorded ID before continuing.101/102 submission cleared composer;102 had Reply posted status. Table card authoritatively reported102 active replies; separate search found101 and102.
- Ordinary discussion rendered100 unique earliest replies, no101/102, matching the established first100 limit. Search for102 returned its exact focused link; opening loaded101 unique rows (001–100 plus102), exactly one target102 and no101. Explanation: Earlier replies and the linked reply are shown below. Replies between them are not shown. Count explicitly101 active replies shown, while Table card total102.
- Target102 ID `ab330a70-947f-47b6-9266-1b99e0b328df`, target101 ID `07394c56-ccfa-4e2c-af13-4c71dc4724ed`.102 scrolled into view (top87.5/bottom247.5px); reload preserved it and unique rows.360/390 document/scroll widths matched; viewport reset. No extra reply submitted from the focused window.
- First100 remains a bounded view: a newly posted101/102 is not automatically appended there; its direct/search link loads it. This is the existing limitation observed in the test, not full reply pagination or a claim that all102 are rendered together.
- Evidence `/private/tmp/plates-batch8-focused-reply102.jpg`. Captured error-level browser entries0. Browser retained on focused102, no unsent draft.

This closes populated browser comment-page/deep-link and first100 late-reply destination coverage for these fixtures, plus successful keyboard submission in original-comment, Table-question and Table-reply composers. No new source/build/lint needed for this browser-only pass. Other form variants, offscreen/versioned notification receipt edges, cross-account concurrency and controlled timeout/worker/access matrix cases retain their own limits. No account/privacy/membership changes, photo worker/service/database commands, Git/dependencies/deletion/project upload or release action. Exactly31 comments,1 question and102 replies remain; cleanup is not authorised.

## 20 October 2026: approved photo-only reply edit/restoration — passed

Owner explicitly approved temporarily blanking the retained synthetic reply's text while keeping its photo, then restoring the exact original text. Only reply `e778ca5d-3a40-4fd1-9622-ea511c33e95f` in Table `3631bf7a-7bc1-472f-9817-4035007747ce`, question `1b2f3827-c575-4aac-862e-1dbdbfbfe29e`, was edited.

- Initial state: original text **QA photo reply: valid replacement after processing failure.**, no links, one loaded synthetic photo (922×2048), two reply rows.
- Cleared text and saved using Cmd+Enter. Editor closed and Changes saved appeared. Reload confirmed no original text, the same reply/photo still loaded at922×2048, and two active replies remained. Valid existing-photo-only edits are accepted rather than blocked as empty.
- Reopened the same reply (body empty), restored the exact original text using Ctrl+Enter and reloaded again. Original text appeared once, the photo still loaded at922×2048 and two reply rows remained. No extra reply/upload/photo removal. Edited label/update timestamp remain as the normal consequence of the approved edits.
- Captured browser error-level entries0. Proof of restored final state: `/private/tmp/plates-batch8-photo-reply-restored.jpg`. Browser retained on the question, no edit draft left open.

This closes the live **photo-only reply-editor** validation and both keyboard-shortcut checks for this fixture. Message-editor text/link-only/empty checks passed earlier; this is not a claim that every compose/edit form or photo-bearing Plate/message editor was newly exercised. No source change/fresh build, worker/service/database commands, Git, dependencies, deletion or remote project action. Earlier permission-pending notes are superseded by this execution.

## 20 October 2026: current closed-Table access regression — passed

Used the existing peer session and direct URL of the previously closed Batch1 QA Table `a1e571e4-fa31-49c6-a88b-902767f3e329`. Initial request and reload both showed the neutral We can’t open this page screen, with no Table conversation rendered. Your Tables exit returned to /tables with its expected headings. Captured browser errors0. Screenshot `/private/tmp/plates-batch8-closed-table-denial.jpg`; temporary access-check tab closed.

This is one current authenticated page-access regression for a closed/former-member fixture, not a direct REST/Storage test, signed-out check or complete privacy matrix. No access/membership/auth/data/source/service/Git/dependency/deletion changes.

## 20 October 2026: approved old-context post and message edits — passed

Owner explicitly approved one labelled message in Edge Content edges 0b14b44a and edits of only that new message for keyboard/empty validation. Existing signed-in peer used; no new account, membership or privacy changes.

- From the linked older-message neighbourhood, posted **QA Batch 8 — older-context rehearsal**. Exactly one message appeared, ID `3763b706-166d-4577-8729-c8a612b37f62`. Route returned to the Table without `entry`/hash, old-context notice disappeared, composer cleared, timeline reached its end (scrollTop8371 + clientHeight426 = scrollHeight8797).
- Opened only that message's editor. Whitespace-only text with no links/photos, submitted using Cmd+Enter, kept the editor open and displayed **Add text or a link before saving.**
- Valid text edit: plain Enter inserted a newline and left the editor open. Cmd+Enter saved, closed the editor, showed Changes saved and rendered the edited text/Edited label.
- Valid link-only edit: empty text plus `https://example.com/qa-batch-8`, submitted from Links using Ctrl+Enter, saved and rendered the expected hyperlink. The external address was not opened.
- Empty text/links via Save changes produced the same contextual warning. Correcting the draft allowed successful text-plus-link save through the button.
- Final retained text: **QA Batch 8 — older-context rehearsal · keyboard and validation checks passed**, plus the example link. Reload confirmed the same single message ID/text/link and an empty composer. Captured browser error-level entries:0. Proof: `/private/tmp/plates-batch8-post-edit-passed.jpg`.

This closes old-context posting-to-latest and live **message-editor** text/link-only/empty checks for this fixture, including both keyboard shortcuts. It does not claim photo-only edits or live shortcuts across every other form. One new test message remains; only its own text/links were edited. No removal, extra message, uploads, worker/service/database commands, source change, Git, dependencies or remote project action. No new lint/build needed for browser-only testing. Prior permission-pending statements below are historical and superseded by this result.

## Current coverage correction — 20 October 2026

The original remaining list below describes omissions from this particular pass, **not project-wide untested journeys**. It was too broad when presented as the overall remaining work. Read `QA_TEST_COVERAGE_REVIEW_2026_10_20.md` for the reconciled evidence and narrowed next checks. Earlier signup, sign-out/in, Table lifecycle, real concurrency, photo failure/retry, API/privacy, follow-acceptance and owner/tester browser passes count; no blanket repetition required. Historical entry retained below.

## 20 October 2026: retained large-history browser check

- Reused existing Edge Content edges 0b14b44a, Table `565b4220-f6a4-4791-be67-910ddd844563`, in the peer account. No bulk messages created. Latest view contained boundary messages 4–51 plus the retained removed-message/share entries; boundary message 1 was absent from that latest window.
- Table search for History boundary fixture 1 found its exact retained message `a4b085c0-bbf9-4f6b-b59a-1e764398f3bd` alongside substring matches. Its View in Table link opened the older context, with the explicit up-to-20-earlier/20-later notice, earlier retained placeholders and boundary messages 1–21. Target was scrolled visibly into view (desktop top177/bottom337px). No claim about transient highlight colour based on the later screenshot.
- Back to latest messages restored the latest window and removed the old target from the rendered window. Measured conversation scrollTop8295 + clientHeight448 = scrollHeight8743: returned to the end. Browser Back reopened the older context.
- At360px the older target stayed within the viewport (left16/right344/top399/bottom565); document width and scrollWidth both360. At390px both390. Temporary viewport reset. Local screenshot: `/private/tmp/plates-batch8-old-context.jpg`.
- This closes the browser **older-message search/navigation/surrounding-context/latest-return** gap for this retained fixture. Posting from the old context is separately awaiting the explicit one-message test permission. No posting/edit/removal, SQL/service/worker/source/Git/dependency/remote action in this check; normal read receipts remain active.

## 20 October 2026: existing-content browser pass

Owner asked whether the agent could perform any Batch 8 tests. Used the existing signed-in IAB peer and retained QA Plate/Request, within prior read-only browser/unsaved-draft permissions. No new posting, saves, likes, follows, accounts, uploads, privacy changes, worker/service operations or database commands. Normal page read receipts remain active. This is a partial rehearsal, not alpha acceptance.

| Journey | Result |
| --- | --- |
| Saved Plate → current original | Menu retained “Original saved text” and edited-original warning; current Plate displayed “Edited original text”. Snapshot/current distinction intact. |
| Filtered Menu → Plate → Menu | Search QA Batch 3 returned the expected saved Plate. The Plate return link retained the encoded search and saved-item anchor. After draft discard, returned to that exact filtered Menu URL/card. |
| Dirty Plate editor Cancel → Keep editing | Discard prompt appeared; Keep editing retained the exact unsaved rehearsal text. No edit submitted. |
| Dirty Plate editor route link → Discard changes | Ordinary Menu return link prompted before leaving. Discard removed only the agent's unsaved local draft and returned to the filtered Menu; stored original remained unchanged. |
| Saved Request → current discussion | Menu's Open current discussion opened the expected existing QA question and its three active replies. No extra save or reply. |
| Reply plain Enter | Typed scratch text, pressed Enter, read textarea value ending in newline; no reply submitted. Cleared only that unsent scratch draft. |
| Account menu Escape/focus | Menu displayed peer identity; Escape closed it and focus returned to Open account menu. No sign-out/settings action. |
| Clear Menu filter | Show all saved items returned /menu, empty search field and Saved Requests section. An immediate transitional snapshot initially retained input text; settled repeat had empty DOM value. No confirmed persistent reset defect. |
| New-comment plain Enter | Scratch comment remained unposted (zero comments); navigating away discarded it. This is the documented existing creation-draft limitation, not a failure of the edit-only exit guard. |
| Browser errors | Zero captured error-level entries for this pass. Does not cover every route or prove absence of hydration/network failures. |

Evidence: `/private/tmp/plates-batch8-menu-reset.jpg` (full Menu with cleared filter). Browser returned to the existing QA question, no unsaved scratch text retained. No source changes, so no fresh build/lint/typecheck run; final source checks from the follow-up remain the latest. No Git/dependencies/deletion/remote project actions.

## Remaining rehearsal, not covered by this pass

1. Fresh account/signup/sign-out/in and denied direct-access matrix, including direct API/media URLs and separate-account isolation. Requires a named disposable local identity and concrete auth/fixture scope; existing sessions should not be signed out without permission.
2. Follow acceptance and alert/read-state checks across two accounts; privacy conversion and access revocation. Requires permission for the exact test relationships/accounts; no existing follows removed implicitly.
3. More than 50 timeline entries, older-neighbourhood context and posting from that context; populated comment paging, more than 100 replies and edited mentions. Locate suitable existing fixtures first or obtain explicit creation scope. Current known notification Table has only three root entries; this cannot exercise those boundaries.
4. Real successful/failed edits and Cmd/Ctrl+Enter submission, duplicate retry/concurrency, membership change/rejoin/closure. Draft-only checks do not close these gates.
5. Stopped/delayed worker, upload failures/timeouts/retry and resulting counts/visibility. Needs explicit worker/service and synthetic-upload scope; no shutdown/recovery or cleanup inferred.
6. Actual phones, browser text enlargement/full screen reader and remaining earlier-batch limits. Hosted email/worker/backup/restore and managed-migration integration follow separately.

Any synthetic data created later remains retained unless exact removal is separately approved. Existing rollback test scripts must be inspected before execution; this document grants no database, erasure, activation or cleanup permission.
