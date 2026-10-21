# Review of owner-supplied end-to-end feedback — 18 October 2026

**20 October update:** Owner reviewed this assessment inline in a separate Downloads copy. Current accepted/deferred/closed items and two subsequent chat clarifications are recorded in [QA_FOLLOWUP_DECISIONS_2026_10_20.md](QA_FOLLOWUP_DECISIONS_2026_10_20.md). That decision record supersedes proposals below where they differ; original assessment retained as history. No application changes or tests in this update.

## Status and evidence

Reviewed `plates-qa-report-2026-10-18 (1).md` against HANDOVER, earlier QA decisions and current local source. Owner has not reviewed/approved every recommendation. Report is evidence to assess, not implementation authority. No application edits or runtime reproduction performed for this review; no tests/build/service restart, browser actions, DB/worker/credential access, Git, dependency, deletion or remote action.

The owner previously accepted the revised visual layout and compact mobile sizing; deeper mobile optimisation is deferred. That acceptance does not close the remaining integrated rehearsal gates. Earlier handover entries asking for owner visual review are superseded by the subsequent acceptance in chat.

Report's successful journeys are tester-reported results, not newly verified here. Its untested list means this tester did not exercise those cases; it does not erase earlier automated/browser evidence. In particular, direct-access checks have earlier local test coverage, but the final current-build/account/access matrix still needs explicit acceptance.

## Recommended sequence (proposal only)

1. **Reproduce and diagnose:** account switching/session identity, unexpected code send, hydration/preload errors, request volume. Capture exact build, route, action and one-tab request counts without recording tokens/codes. Use isolated approved fixtures for auth/data mutations. Prioritise any confirmed cross-account exposure before release.
2. **Focused usability fixes:** toast placement/hit testing, empty-edit validation, last-Admin explanation, matched edit-panel titles. Preserve existing attachment/links-only contributions and permission checks.
3. **Owner-reviewed copy pass:** consistent labels, simpler introduction, updated bell/envelope description, date presentation. Preserve audience, saved-copy, source-discussion and erasure distinctions.
4. **Finish rehearsal:** current direct API/RLS/media access matrix, sign-out/in, private/open conversion, unpublish/leave, worker failure/recovery, older-message >50 context/posting and populated/late reply/comment cases. Do not automatically rerun existing fixture-creation/activation scripts; review their scope and permissions first.

No Table invitation redesign, global Request rename, automatic URL/mention feature, comment keyboard shortcut or test-data cleanup included by default.

## Report section 1 — six headline findings

| ID | Assessment from current source/history | Recommended disposition |
| --- | --- | --- |
| F1 Immediate Table addition/full history | Explicitly agreed product behaviour, independent of private Plate readership. Only Table Admins have the relevant management permission; report wording “anyone” does not establish non-Admin access. Creation/addition copy already explains immediate access/history. Unwanted addition remains a legitimate product concern. | Preserve agreed behaviour unless owner reopens it. Invitations, mutual-follow restriction or hiding historical messages would be a separate permission/data-model feature. Separately test non-Admin denial. |
| F2 Earlier-session state/profile ID/Y avatar | Important but unconfirmed. Email form state starts empty; `autocomplete=email` can restore browser input. CurrentProfileProvider clears identity/picture on sign-out/account change and fences late responses. Generic fallback avatar alone is not disclosure. A prior profile ID in a request requires knowing which session issued it and what response was readable. Other components/auth transitions still merit audit. | Highest-priority controlled sign-out/account-switch reproduction. Distinguish autofill, placeholder, stale outgoing filter and actual readable cross-account content. Do not disable email autofill or indiscriminately clear storage as a presumed fix. |
| F3 Code sent while typing | EmailCodeForm invokes OTP send from form submit; onChange only sets email/clears error. Sending already has a synchronous in-flight guard and disabled button. Enter can intentionally submit a form. | Reproduce with actual key/action sequence. Investigate implicit submission/automation/autofill; do not claim an onChange autosend bug from current source. No new code send authorised in this review. |
| F4 Hydration #418 and prefetch503 | Reported runtime failures merit investigation. Source inspection cannot identify their cause. Locale/date/client-only rendering is a hypothesis, not a diagnosis. | Reproduce on one stable build and inspect detailed errors/server logs. Correlate503 timing with server availability/build restarts; do not dismiss or assume one cause explains both. No blanket client-only conversion. |
| F5 Toast covers Post reply | Source supports overlap risk: ActionNoticeProvider uses fixed bottom-centred z50 panel with pointer-intercepting surface. Exact overlap/hit testing not newly reproduced. | Strong focused-fix candidate. Choose placement and pointer behaviour that preserve accessible announcement/Dismiss while keeping controls usable on desktop/phone. |
| F6 ~450 account_updates requests/2min | LiveUpdates already subscribes to Supabase realtime and has10s fallback polling, pending guard, hidden-tab skip and cleanup. One stationary mounted instance is roughly a dozen periodic polls in2min plus initial/reconnect polls, not450. Route churn/multiple tabs/reconnect/remount interactions or counting different endpoints need inspection. AccountActivity separately records activity at60s. | Measure per endpoint/tab/stable route; check subscription/refresh loops and visibility handling. No evidence yet for simply “add realtime” or arbitrarily change interval. |

## Report section 2 — minor bugs/UX

| ID (report order) | Assessment | Recommendation |
| --- | --- | --- |
| M1 Empty message edit generic error | TableContentControls normalises links but does not validate an empty edit against existing attachments before RPC; formError has generic fallback for ordinary validation objects. | Fix candidate after checking backend rule. Photo-only/link-only records must remain valid; “Add some text” is not universally correct. |
| M2 Disabled last-Admin demotion unexplained | Source disables demotion for last Admin without a local explanation. Leave/handover does explain the rule elsewhere. | Add visible or accessible explanation; native tooltip on a disabled button alone is insufficient. |
| M3 Missing labels | Plate text has wrapping label; Table MentionInput has visible/wrapping or sr-only label; notification links contain sr-only names. | Verify actual accessible names and reported route/build with browser/assistive tooling before adding redundant aria-labels. Source is not full accessibility certification. |
| M4 Chat URLs not clickable | PlateContent links explicit links-array entries; chat posts pass empty links array and do not auto-link raw body URLs. | Enhancement, not automatically a regression. If wanted, use safe HTTP(S) linkification preserving escaped text, punctuation and existing external-link safety. |
| M5 Plain @username in Plate body not linked | PlateContent resolves canonical stored mention IDs; generic plain @text is not the same as a resolved mention. Table MentionInput supplies a member-scoped workflow; Plate creation has no equivalent picker. | Decide whether Plate tagging is desired, including eligible people/notifications/privacy. Do not link arbitrary names or promise mentions work in original comments, which are plain text. |
| M6 Ctrl/Cmd+Enter comment submission | Original comments use ordinary textarea/form, no shortcut. Table composer has separate keyboard semantics. | Optional convenience; agree before implementation, retain multiline/IME and duplicate-send guards. |
| M7 First-step Back clickable | Introduction explicitly uses disabled={busy || index === 0}. Earlier browser checks also found first-step disabled. | Not confirmed against current source; reproduce actual click/step/build before any change. |
| M8 Tour steps not sidebar match/Search missing | Tour explains product concepts, not one step per nav item. Search is already named in People body and sample. | Keep concept-led tour unless owner prefers a navigation tour; can make Search discovery clearer without rebuilding all steps. |
| M9 Account location unclear | Tour says Account without locating avatar menu. | Good small copy candidate: explain avatar menu. |
| M10 Photo replies counted before visible | Current ReplyForm awaits uploadTableImages, which polls each intent until ready, then posts reply; worker-off path times out before reply RPC. This conflicts with proposed queued-reply explanation. | Reproduce with precise reply ID/state and distinguish old data, missing signing/access, stale count, timeout/retry and actual invisible posted reply. Do not change counts or insert placeholders on assumption. |
| M11 Comment/reply ordering differs | Comments show newest/older page wording; Table replies explicitly say Oldest first. Audiences/query/pagination differ deliberately. | Keep current ordering; improve any unclear label if reproduced. Do not reorder/paginate as a copy tweak. |

## Report section 3 — copy decisions

| Group | Recommendation |
| --- | --- |
| Question/Request | Keep agreed Ask the Table → question, saved to Menu as Request. Review confusing stray Request references; do not rename all questions to Request without owner decision. |
| Add/Publish/share a Plate | Standardise action labels/context where confusing; “share to a Table” is a distinct operation and needs distinct wording. |
| Edit contribution/Edit message | Source confirms panel uses generic Edit contribution while inner heading varies by kind. Good contextual-title fix for message/reply/share/question. |
| Field labels/optional markers | Harmonise create/edit labels and mark optional fields accurately. Empty text is conditional on links/photos; do not mark every field required or optional blindly. |
| Photo/picture/file terminology | Minor style choice. Existing single avatar/Table picture versus attached photos distinction can be useful; verify actual picker control before assuming browser Choose File is an app defect. |
| People link labels | Manage your people versus Manage following and requests: good consistency candidate. |
| Unselect/Remove | Prefer Remove from selection or Deselect to avoid confusion with Remove from Table. Neutral lowercase example username is a good tweak. |
| Dates/seconds | Notification lists still use locale date/time strings including seconds; conversation formatting intentionally has short time, short date/date-time, date dividers and full accessible timestamps. Standardise related visible formats and remove unnecessary seconds; preserve timezone/accessibility and contextual day/time distinctions. |
| Removed placeholders | Align grammar/punctuation while distinguishing removed comments/messages/shares/questions; keep retained-history and active-count meaning. |
| Confirmation buttons | Pick consistent principles and clear named outcomes; Cancel, Keep in Menu and Keep comment can suit different consequences. Do not force all actions into Keep/Remove. |
| Contractions, quotes, comma style, en dash | Low-priority editorial pass. British English does not require eliminating every serial comma; choose house style and preserve clarity. No global punctuation replacement. Tagline-comma removal is a small wording proposal. |
| Tour technical language | Simplify prepared photos/retained content/account erasure without falsely promising all copies survive erasure. Link fuller retention/access explanation where appropriate. |
| Saved confirmation/original edit copy | Can shorten confirmations while retaining frozen-copy and live-Request distinction. Report's “Saved to your Menu” alone may omit useful live-discussion context. |
| Save another source | Explain linking another Table discussion to an existing saved Plate; do not imply creating a second saved snapshot or merging private replies. |
| Menu results | Menu results for… is a reasonable small wording change. |
| Original Plate comment label | Add a comment is reasonable on original detail if separate audience text stays visible; Table replies must still make the distinction explicit. |
| Open-account wording | “Anyone signed in can see Plates from open accounts” is clearer and retains admission boundary. |

Additional source-confirmed tour mismatch: People step still puts “mentions” in the bell description; Table mentions now belong to envelope/Table activity. Tables step says “people you invite” although addition is immediate. Update these descriptions alongside any approved tour copy pass.

## Rehearsal, access checks and cleanup boundaries

- Carry report's untested sign-out/in, private/open change, upload, unpublish, leave and phone coverage forward as applicable; earlier photo/mobile/leave checks are useful scoped evidence, not a complete current release pass.
- Access tests should cover allowed AND denied reads/writes across anonymous, current member, non-member, former member, approved/unapproved follower and notification recipient; include exposed RPCs and private-media signing/storage. “Only own rows” is not the expected rule for every table: members may read others' Table messages and permitted viewers may read others' Plates/comments. Test actual visibility contract, not an assumed owner-only policy.
- Report says notification journeys/follow acceptance passed, but gives little case-level evidence. Record as tester-reported; do not equate opening a Table with acknowledging unseen thread replies. Existing visible-rendered-only receipt rule remains.
- Test-data-removal list is a third-party proposal, not owner deletion permission. No account, invitation entry, Table, Plate, follow, Storage object or fixture removed. Review exact identifiers/dependencies and erasure/retention consequences before separately authorised cleanup. Do not automatically disable the test account or revoke invites/follows either.
- No claim of release readiness from this report alone. Hosting email/worker/backups/restore/migration integration remain separate from local QA.
