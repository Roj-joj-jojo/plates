# QA Batch 1 — Table controls

17 October 2026. Owner authorised Batch 1 and confirmed a non-default feature branch. No Git operation was run. Scope: report 6, 7, 16, 18, 47; Table-management portion of 35 and related picker feedback from 17.

## Changes

- Role changes, member removal/addition, ordinary leave, last-Admin handover and close-and-leave now use existing in-app AlertDialog styling. Named person/action snapshots stay fixed while pending/retrying. Cancel has initial focus; closing returns focus to the initiating control where available, otherwise the member-management container. Dialog scrolls within a short viewport.
- Last Admin first chooses a replacement or closure, then sees a named consequence confirmation. Existing server-side last-Admin/access rules are reused unchanged. Closing preserves content and ends access; no physical deletion path introduced.
- Member rows sort by username/name and profile ID, independently of role, so promoting/demoting does not move action buttons. Role-change results have specific success text. Additions already completed by another Admin produce an explicit no-change result rather than a silent no-op.
- Before management mutations, the client fetches current membership and checks actor permissions, target membership/role, last-Admin departure state and the closure's affected membership set. Changed state requires cancelling/reviewing. These checks are user-experience safeguards, not an atomic version contract: existing database access/last-Admin guards remain authoritative; races after the client read remain bounded by those existing rules.
- Exact-username lookup remains; Enter selects/looks up the person rather than submitting Create Table. The picker rejects self, existing members and duplicate selections with explanations, clears lookup errors on input change, and locks selection while lookup is pending. Creation receives the current profile ID from the existing own-profile view. New-table submission is guarded during lookup and duplicate/in-flight creation.
- Message/content moderation menu says “Remove [message/reply/share/Request] as Table Admin” rather than ambiguous “Remove as Admin.” Removal behaviour and permissions are unchanged.
- Immediate joining, full earlier history, existing member discoverability and existing backend functions stay as agreed. No mutual-follow rule, invitations, new autocomplete endpoint, schema, dependency or activation needed.

Files: `src/components/table-members.tsx`, `src/app/tables/new/page.tsx`, and the moderation menu label in `src/components/content-controls.tsx`.

## Verification

Owner approved lint/typecheck and stopped app preview for production build. Initial lint passed; first typecheck caught an action-union narrowing issue, corrected by separating chooser/leave action types. Subsequent typecheck, final lint and production build all passed. Build completed compilation, TypeScript, route generation and tracing. No source changes after those final checks.

At implementation handoff, no browser/authenticated mutation tests had run. Existing backend functions were inspected, not changed. The later browser verification below supersedes the pending-browser status; no new test framework was installed.

## Agent browser verification — passed, 17 October 2026

Owner explicitly authorised browser testing, allowed any QA Table/accounts and prohibited deleting `plates.admin`. Used existing signed-in in-app browser (Social HTTP Peer fixture) and Firefox (owner account); no credentials/codes read or entered. Created one empty dedicated Table, **QA Batch 1 browser 17 Oct**, ID `a1e571e4-fa31-49c6-a88b-902767f3e329`. All membership/role/departure mutations were confined to that Table. Existing Table content was read only for the final moderation-label check.

Passed through visible UI:

- Create form: Enter looked up a valid member without submitting the populated Table-name form; own username, unknown username and duplicate selection received the expected messages. Editing the lookup cleared its error. Explicit Create Table succeeded with the chosen member.
- Existing-member lookup was refused clearly. Sole Admin demotion stayed disabled. Promotion/demotion used named in-app dialogues, produced success feedback and kept member row order. No native JavaScript confirmation appeared.
- Cancel left roles/membership unchanged. Initial focus was Cancel; Tab cycled inside the dialogue, Escape closed it, and focus returned to the originating button after close settled.
- Member removal and re-addition succeeded. The second signed-in session observed its own access/Admin changes and the first session's departure. No new invitation/relationship requirement was introduced.
- With the first Admin's removal dialogue open, the other Admin removed that exact member. Confirming the stale dialogue requested review rather than silently acting on a different person.
- With both Admins selecting the same new member, the second completed the addition first; the first confirmation returned “These people are already members. No changes were needed.” One member row remained.
- Ordinary leave Cancel/confirm and last-Admin chooser/handover Cancel/confirm worked. Handover promoted the named replacement and returned the departing account to Tables. Re-addition restored access so testing could continue.
- Closure snapshot listed three affected members. A separate same-account QA tab removed one while the closure dialogue stayed open; confirmation refused and asked for a fresh review. Reopening showed the current two-member audience. Confirming then closed only the empty QA Table; both independent sessions lost access.
- Phone overrides: at 390×844 the last-Admin chooser fit with no horizontal overflow; at 360×640 the closure dialogue fit within viewport (left/right 16/344, top/bottom 171/469) with document width 360 and no dialogue horizontal overflow. Viewport override reset afterwards. These are desktop-browser responsive checks, not physical-phone or full assistive-technology certification.
- Read-only menu check in an existing synthetic Table showed **“Remove message as Table Admin”** for another author's message. Did not invoke content removal or send a message.

**Persistent result:** dedicated QA Table is closed through its normal soft-close flow, with membership/history rows retained. No Plates, messages, images, accounts (including plates.admin), files or Storage objects deleted. Existing Table memberships/content untouched. Temporary browser QA tabs closed/left for automatic turn cleanup; Firefox returned to its original app-access tab. No app source, schema, terminal tests/builds, worker, Git, dependency or hosted actions in this browser pass. Previous lint/types/build results remain applicable.

**Limits / known backlog:** no offline/timeout injection, true simultaneous server-transaction race, IME, physical phone or full screen-reader suite. Existing success/lookup messages can outlive later external membership changes; their broader lifecycle remains report 17 / Batch 3. No new Batch 1 blocker found. Backend atomic access/last-Admin invariants were not re-proved by browser tests; client stale-action checks worked in the ordered two-session scenarios above.

Screenshots saved locally under `/private/tmp/plates-qa-batch1-*.jpg`: confirmation, phone chooser, close-phone, stale-target, stale-close, no-op and moderation menu. No screenshots of the owner account-management page are included as evidence. Next: Batch 2 identity/sign-in.

## Owner browser acceptance

Start the built app from the project folder:

```sh
npm run start
```

No photo worker required for this batch. Use two accounts and a disposable QA Table for changes that remove access or close it.

1. Create Table: try own username, unknown username, valid username and the same selection twice. Correct messages should clear when relevant input changes. Enter in username selects the person without creating the Table. Creating from the Table-name field/button still works.
2. Manage Table: own/existing-member lookup is explained, no silent addition; a genuinely new person can be selected. Add confirmation names people and full-history access. Cancelling does nothing. If another Admin adds the selection before confirmation, review produces a clear already-member outcome.
3. Promote/demote: in-app named confirmation, Cancel/confirm and success state. Rows stay put after refresh. Sole Admin cannot demote themselves. Removing a member warns of access loss/contribution retention.
4. Leave: ordinary leave, last-Admin replacement choice/confirmation and closure confirmation all stay in-app. Test Cancel at each step; confirm destructive departure only in the disposable Table. A second account should reflect access/Admin state.
5. Stale selection: open a target/close confirmation; use another Admin session to change the target role/remove the target/change the member list; confirm. It should request review rather than silently choosing a new target. Existing backend last-Admin guards must still refuse invalid changes.
6. Keyboard/narrow screen: Tab stays within dialogue, initial focus on Cancel, Escape cancels when idle, pending actions prevent duplicate submissions; focus returns to the trigger/fallback. Long names/actions remain usable at phone widths.
7. Another member's contribution menu clearly says what is being removed as Table Admin; it must not imply removal of Admin rights. Existing content-removal confirmation remains intact.

Report results rather than assuming source/build checks prove interaction correctness. After acceptance, continue Batch 2 identity/sign-in; bell/envelope split is still a proposal for Batch 5.
