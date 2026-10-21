# QA Batch 2 — Identity and sign-in

17 October 2026. Owner requested this batch; the same-session non-default-branch confirmation remains applicable. Owner approved lint/typecheck/offline test, stopped preview for build, authorised restarting the built preview and authorised temporary fixture display-name edits/restoration and fixture sign-out/in using its local Mailpit code. No owner account changes, account creation/deletion, Git or external publication.

## Implemented

- Account has a display-name editor using existing authenticated `update_display_name(text)`. Own active-account restrictions remain in the database. Unicode character count, 80-character limit, blank/control validation, save/cancel/error/pending feedback; immutable @username unchanged. No identity schema or migration needed.
- Display name is primary and fixed username secondary in Feed/Plate author labels, original comments, account menu and follow/comment/mention notification labels. Existing profile/People/Table identity rules already use name plus handle; saved Menu attribution stays frozen. Usernames on Feed/detail use the existing guarded resolve-mentions RPC, not a new directory.
- Successful email verification goes to Feed; the existing username guard then the existing unseen-introduction guard apply. Username choice also continues to Feed; the username page no longer sends already-configured accounts to Account. No completion resets/backfills or new-account fixtures.
- Sign-in starts in returning-user mode with “Welcome back”; Create account switches to “Join Plates.” Quiet auth layout omits signed-out sidebar/bottom navigation. Mode controls are neutral selected segments, with Send/Verify as primary actions. Error copy is curated for code failure, rate limits, connection failure and general signup/sign-in refusal; upstream database/Auth message strings are never rendered by the form. Invite-only admission is unchanged. Input corrections and mode switches clear relevant errors; in-flight guards prevent repeated code requests/verifications.
- Header identity now lives in a shared root client provider rather than being recreated in every header. Route/visible/profile/auth events revalidate own profile and picture access. It holds only in-memory state; auth changes clear prior identity/picture, late responses are fenced. An authorised same-account/same-object signed picture URL is reused briefly to avoid repeatedly resetting image loading; renewal is due after four minutes, signed URL lifetime remains five minutes. Failed/removal/changed locations discard it. Visible-minute checks renew; no public URLs, persistent photo cache or access expansion.
- Avatar roots remount when source changes to isolate old image-loading cleanup from the replacement image. Picture-save/name/username actions signal the shared header to reload. These address observed source-level remount/loading risks, not a claim that the original intermittent photo issue has been conclusively reproduced or eliminated.

## Checks passed

```sh
npm run lint
npm run typecheck
node scripts/test-account-ux.mjs
npm run build -- --webpack
```

Offline assertions cover safe upstream-error handling, rate/connection/invalid-code guidance and blank/Unicode/length/control display-name limits. Node emitted its module-type detection warning when importing the TypeScript helper; test passed, no package/module/dependency changes made to silence it. Initial typecheck identified a nullable signed-picture cache condition, fixed with an explicit guard; rerun lint/typecheck and production build passed. Build compiled, typechecked, generated routes and traced. No source changes after passing final checks.

Owner-approved `npm run start` initially sandbox-refused listening on loopback; exact command started with approved escalation. Preview is running on 127.0.0.1:3000 in execution session **7184**. Photo worker was not started. No terminal database/Storage command or candidate activation.

## Browser evidence

Used the existing Social HTTP Peer fixture session:

- Blank and 81-character name edits disabled Save. Temporary valid Unicode name saved through the existing RPC; header menu, profile and an existing Table message showed it with the original fixed handle. Restored the original fixture name, verified it, and cancelled an overlong draft without saving. No contribution body/snapshot was rewritten.
- Signed out only the fixture account. Sign-in showed a quiet layout, “Welcome back,” neutral mode controls and no app navigation. At 390px, captured the empty sign-in screen before entering an address/code.
- Requested the fixture's local email code; invalid six digits produced the curated verification message. Valid fixture code authenticated successfully and routed through Feed to `/introduction` for this existing unseen account. Completion was not marked/reset. Header/menu showed the restored fixture identity after authentication. No real signup or fixed-username change tested.
- Existing photo-bearing profile rendered a loaded image in People search and its profile. After a Menu round trip/browser Back, the profile image settled loaded again. Fixture has no own picture, so its header tests cover initials and identity changes, not the reported own-photo header failure.
- Read-only owner Firefox Menu test was attempted, but native accessibility state and screenshot stayed inconsistent (new tab state versus old page image). No owner setting/sign-in action was taken. Temporary tab was closed back to the original app-access tab. Owner subsequently checked Menu → Account → Your profile on their photo-bearing account and reports all pages maintain the profile picture. **Issue 23's navigation acceptance check passed (owner-reported).**
- No client errors were captured in the fixture page's short error-log check. Browser viewport override reset afterwards. Temporary Mailpit tab closed. Signed-in fixture remains signed in, original display name restored; no accounts created/deleted, no owner identity/privacy/membership changed, no uploads/posts/messages sent.

### Email handling correction

The first Mailpit inbox DOM snapshot inadvertently included code previews, contrary to the intended no-code-output approach; assistant acknowledged this immediately. No email screenshots or code files were saved, and no codes are repeated in these notes. Subsequent extraction targeted only the authorised fixture message, kept its code in memory and cleared that variable after entry. Do not claim the initial tool output was secret-free; future mailbox checks must filter previews before emitting any snapshot/output. Other accounts' messages/codes were not used for authentication.

## Remaining acceptance

- Owner photo-bearing navigation check passed as recorded above. Actual expiry/failed signing/auth-switch races were not tested over a full five-minute interval; this scoped pass does not establish those cases.
- Fresh invited signup and initial username choice, uninvited Create-account refusal and completed-tour returning sign-in are not newly browser-tested here. No accounts were created or existing completion states reset. Offline safe-error checks and the unseen fixture sign-in cover narrower cases only.
- Full cross-session name propagation without navigation, conflicting name edits, network failures, expired-code timing, physical mobile and full screen-reader acceptance are not established. The existing name RPC has no optimistic revision argument; no new conflict contract was added. Snapshot attribution remains historical.

Images: `/private/tmp/plates-qa-batch2-signin.jpg` (empty form), `plates-qa-batch2-name.jpg` (temporary test profile) and `plates-qa-batch2-restored-profile.jpg`. None is a mailbox/code screenshot.

Next planned batch: forms/validation/saving feedback (Batch 3). No new database activation needed for Batch 2.

## 2026-10-17 owner acceptance update

Owner reports “Yep all pages maintain pfp” after the requested photo-bearing navigation check. Recorded issue 23's navigation check as passed. Documentation-only update; no source changes or additional agent-run tests.
