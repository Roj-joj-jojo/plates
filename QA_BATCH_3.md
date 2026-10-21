# QA Batch 3 — Forms, validation and saving feedback

**Latest acceptance update, 17 October 2026:** Owner authorised browser photo tests and starting/stopping the dedicated local worker, then confirmed a feature branch for a caption correction. Real synthetic-photo Plate/chat/reply selection and sending, removal, count/size rejection, decode failure and valid replacement passed. Caption fix passed lint/types/offline/build and browser verification. Worker stopped with `drained:true`; preview now running in session23753. Detailed evidence below supersedes earlier upload-not-authorised/not-tested notes for these cases. Forced slow-network/timeout and other listed action-feedback paths remain separate.

17 October 2026. Owner requested implementation; same-session non-default feature-branch confirmation retained. Owner explicitly approved lint/typecheck/offline checks, stopping the agent-started preview, production build/restart, and a fixture-only text/link Plate publish/save/edit plus an unsaved bio draft/cancel. No Git, dependency, schema, migration, worker, upload, deletion or remote-publication actions.

## Implemented scope

- Shared HTTP(S) link validation for Plate create/edit and Table contribution edits: up to ten links, one per line, ordinary bare domains receive HTTPS. Invalid/overlong links identify their line before any request. Schemes, credentials, whitespace, malformed hostnames and non-HTTP(S) values are rejected; database validation remains authoritative. Create/edit Plate labels and link limits match. Editing keeps existing attachments; photo mutation remains separate scope.
- Local photo selection/previews and per-photo removal for Plate creation, Table chat and discussion replies. Limits remain six/four, 10 MB each; invalid selections retain the previous selection. Object URLs are revoked on replacement/unmount. Browser-unsupported previews (including some HEIC files) show a fallback. Selection is local until submission; progress distinguishes uploading, processing and posting. Existing prepared-attachment/idempotency behavior retained; no new worker/recovery contract.
- Visible character counts on Plate text, comments, bio, Requests, share notes and expanded messages/replies/contribution edits. Compact chat shows its counter near the limit (19,000+), preserving composer space. Counts follow the existing HTML UTF-16 maxlength behavior; no server limits changed.
- Input corrections clear form errors; picture Cancel clears failed-photo feedback. Comment/message/Table-management/picture successes retire after eight seconds, subject to browser timer scheduling; actionable errors stay. Cross-route dismissible success notices cover edit/unpublish/follow acceptance/bio/privacy/Menu saves. Saved Plate and Request controls settle to the same saved-copy/View in Menu pattern. Existing Menu remove/Undo/restore feedback retained.
- Bio is separate from account privacy, with counter, save feedback and Cancel. Active bio drafts retain their expected version so a refresh does not silently overwrite them or bypass a stale-version check.
- In-app discard dialogue for dirty Plate/comment/contribution edits and bio Cancel; contribution sheet close also checks. Dirty editors intercept ordinary same-origin route-link clicks and offer Keep editing/Discard changes. Refresh/tab close uses browser beforeunload protection where supported. Browser Back/Forward, programmatic redirects and every mobile lifecycle event are **not** universally intercepted; no persistent draft storage added. Creation/share/message drafts are not covered by this edit-exit guard.
- Menu reads existing snapshot/current revision fields through the signed-in RLS-filtered query. Only a currently readable original can show “Original edited since you saved”; saved text/photos/links/attribution are untouched. Unavailable originals reveal no revision-change hint. Frozen save/erasure/access rules unchanged.

## Checks

Passed final source checks and production build:

```sh
npm run lint
npm run typecheck
node scripts/test-form-ux.mjs
npm run build -- --webpack
```

Offline checks cover domain normalization, multiline numbering, ten-link/length boundaries, unsafe schemes/credentials/whitespace/hosts, photo count/size/type limits, and distinct conflict/access/generic errors. Node's existing TypeScript module-detection warning was informational; no package changes. First lint caught synchronous preview state in an effect; corrected by assigning the local object URL to the image ref with lifecycle cleanup. Subsequent lint/types/build passed. Later focused accessibility/hostname/navigation-guard corrections were followed by final lint/types/build; final offline helper checks passed after hostname corrections.

Approved preview restart required sandbox escalation to listen on loopback. Final preview runs at 127.0.0.1:3000, execution session **81580**. Photo worker not started. No direct terminal database or Storage command.

## Browser evidence

Existing Social HTTP Peer fixture only; owner account untouched:

- Bio counter/Cancel opened named discard dialogue. Keep editing retained draft; Discard restored the original empty bio without saving.
- Empty Plate validation appeared, then cleared after typing. Invalid second link identified line 2. Created exactly one QA Plate with two links, including an ordinary bare domain; rendered links had HTTPS.
- QA Plate ID `1361c2f4-26e5-4dac-98d1-8038720bac9f`, labelled “QA Batch 3 forms — 17 Oct”. Saved once to fixture Menu, then edited original text/links. Invalid edit links preserved draft and did not produce a false conflict message. Cancel/Keep editing preserved the draft. Successful edit closed editor, returned focus to options and showed success.
- Menu retains “Original saved text.” while current original has “Edited original text.” The revision hint appears and current original opens normally. No private/unpublish/revocation mutation performed in this batch; guarded absence rests on the existing RLS query and remains broader acceptance work.
- Success notice later retired; an initial bounded wait timed out before that observation, so exact eight-second timing is not claimed.
- Final rebuilt app: ordinary Menu link from a dirty Plate editor opened discard dialogue; Keep editing preserved draft. Cancel/Discard discarded a later draft without saving. Dialogue bounds at 390px were left16/right374/width358. Final phone screenshot captured after dialogue observation; viewport reset.
- First photo chooser had duplicate accessible controls; changed hidden input to display:none. Final browser count is one named Choose photos control. Tested page error log count zero. No real photo selected/uploaded, message/comment posted, bio saved, account signed out/created/deleted, or original owner content edited. QA Plate and save intentionally retained.
- Initial browser attempt occurred while preview was stopped for build; it failed to connect. After restart, a fresh temporary tab recovered from the browser-generated error page. No browser-security warning bypass.

Proof: `/private/tmp/plates-qa-batch3-menu-final.jpg`, `/private/tmp/plates-qa-batch3-discard-phone-final.jpg`. Earlier phone capture preceded visible dialogue paint and is not dialogue evidence.

## Remaining acceptance and next steps

Session paused by owner on 17 October 2026. The checks below remain outstanding; no further implementation started. Preview last confirmed running in session81580 and left unchanged during documentation wrap-up; recheck service state on return.

1. Photo acceptance now passed for the synthetic-image cases in the latest update below. Forced slow-network/timeout, genuine HEIC preview fallback and physical-phone checks remain untested; do not equate this scoped result with every issue 15 scenario.
2. Follow acceptance, bio save, unpublish, comment timer/edit and Table contribution sheet-close paths need their own browser acceptance; source checks passed but these mutations were not exercised here. Direct API/media privacy, true races, retry uploads, physical phone, screen reader and native reload warnings remain separate.
3. Next planned implementation: Batch 4 conversation clarity, preserving original Plate and private Table audiences. Batch 7 retains save-button visual priority/alignment and remaining layout work. No database activation needed for Batch 3.

## 2026-10-17 — Agent photo acceptance and caption correction

- Owner asked the agent to carry out photo checks in-browser. One existing fixture account was sufficient; no second account needed for these compose/upload/display checks. Owner approved `npm run photo:worker`, processing existing pending local photos if available, and stopping/draining it afterwards. Owner separately confirmed a non-default feature branch and approved correcting the misleading upload caption. Prior approved Batch 3 lint/typecheck/offline/build/restart commands reused for this focused correction.
- Existing Social HTTP Peer fixture; original owner account untouched. Used retained synthetic benchmark screenshot/JPEG images from `/private/tmp/plates-photo-benchmark-9w2Xkn`. Created two additional local test files in `/private/tmp/plates-qa-photo-validation-4DMPvD`: a 16,918,254-byte oversized copy and a small deliberately invalid JPEG. Files retained; no personal photos or deletion.
- Plate: selected two files; both previews loaded (1440×3200 PNG and 4000×3000 JPEG). Removed JPEG, published PNG only. New QA Plate `e1980ff9-97e5-4699-b239-8f7b5fe4da06` has one loaded image and clearly labelled synthetic QA text. Only retained PNG uploaded.
- Table `3631bf7a-7bc1-472f-9817-4035007747ce`: selected two valid files, then selected five to trigger the four-photo limit. Error appeared, prior two selections and typed draft remained. Removed JPEG and posted one PNG message; one loaded image appeared and composer cleared. Message text: “QA photo test: one synthetic photo retained.” No other member added or notified through a new mention.
- Existing Request `1b2f3827-c575-4aac-862e-1dbdbfbfe29e`: oversized JPEG rejected locally with clear 10 MB error; draft retained. After rebuild, invalid JPEG gave Preview unavailable locally, then explicit worker decode rejection. Reply draft and selection remained; no reply was created on failure. Selecting valid PNG cleared error, and retry created exactly one reply (count1→2), loaded photo, cleared composer and showed Reply posted.
- Browser DOM snapshots duplicated some textarea text in their presentation. Direct DOM `.value` reads and the final posted message/reply each contained a single copy; no duplicated-content defect established.
- Fixed one source issue in photo-selection.tsx: busy selection caption now says “Sending selected photos…” rather than “Selected locally · not sent yet”; while busy, it also omits the invitation to replace the selection. Actual upload progress and disabled controls observed. This changes copy only, not worker/Storage flow.
- Final `npm run lint`, `npm run typecheck`, `node scripts/test-form-ux.mjs` and `npm run build -- --webpack` passed. Offline runner retains informational module-detection warning. Restarted approved local preview after build, session23753 at127.0.0.1:3000. Rebuilt browser reply flow verified corrected caption; captured page error log empty. Viewport reset.
- Worker startup was sandbox-refused, exact approved escalation succeeded. Run `3bb56b69-d3f9-413a-86e3-2e78f7f4c350` logged three successful completions (one Plate/two Table) and one deliberate Table decode rejection, zero blocked jobs. Ctrl+C ended with `photo_worker_stopped`, `drained:true`, exit0. Worker health also observed six existing pending Plate sources unavailable; left unchanged, not investigated/cleaned up. Drain confirms this run stopped safely, not that all historical queues are empty.
- Retained new QA Plate, one Table message, one reply, three processed photo outputs and the failed test intent/source. No cleanup, source deletion, account change, Git, dependency, schema, activation, deployment or remote publication. Processing was local Supabase/Storage through normal UI and worker.
- Evidence: `/private/tmp/plates-qa-batch3-photo-plate.jpg`, `plates-qa-batch3-photo-table.jpg`, `plates-qa-batch3-photo-reply.jpg`. These show synthetic images only. Forced slow-network/timeout, worker interruption, real HEIC/mobile and two-account access tests not part of this acceptance. Follow/bio/unpublish/comment/other action-feedback paths listed above still await scoped mutation acceptance; Batch 4 remains next implementation work.
