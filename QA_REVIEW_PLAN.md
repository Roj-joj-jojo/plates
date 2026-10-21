# Plates QA review and proposed work schedule

**2026-10-18 visual follow-up latest:** Owner approved compact controls after screenshot feedback/research. Creation below header; management link below search; compact filled navigation without underlines; Following/Followers/Requests with Received/Sent; compact Plate heart/comment/bookmark and detail heading link implemented. Final lint/types/build and scoped desktop/phone/keyboard browser checks passed. QA_VISUAL_FOLLOWUP.md records limitations and owner visual review next. Preview53804 running; no data/DB/Git/remote actions.

**2026-10-18 Batch7 latest:** Shared Search/People/Menu navigation, header alignment/phone Table controls, readable avatar fallback, secondary Save/distinct liked styling, viewport-bounded menus/dialogs, confirmation opener focus return, styled picture chooser, singular live count and stable naturally sized introduction implemented. Final lint/types/production build passed; scoped desktop360/390/keyboard/short-dialog/query/contrast browser checks passed. QA_BATCH_7.md records exact evidence and untested zoom/screen-reader/device/mutation limits. Preview2550 running; worker not operated. Next Batch8 integrated rehearsal, carrying >50 context/posting and browser follow acceptance; no Git/DB/deletion/remote action.

**2026-10-17 Batch6 latest:** Source query/cursor/card return, Feed/detail dates/end state/content heading, guarded search thumbnail, Table message/reply targeting and older-message bounded context, profile/manage titles/create subsection built. Final lint/types/offline/build and scoped read-only search/Feed/Menu/target/Back/phone/unavailable browser checks passed. QA_BATCH_6.md records >50 context/posting/comment/history/privacy/performance limits. Preview33743 running; worker stopped. Next Batch7 visual/accessibility; no DB/Git/deletion/data/remote action.

**2026-10-17 Batch5 browser latest:** Scoped two-account addition/message/mention grouping and bell separation, list retention, visible clearing/unseen thread protection, exact reply links, reverse delivery/self suppression and native Firefox background→visible behavior passed. Dedicated QA Table/content retained; existing follows/privacy preserved. QA_BATCH_5.md records remaining browser/large-history/failure/access/acceptance limits. Next review limits then Batch6 navigation; earlier browser-pending notes below historical.

**2026-10-17 Batch5 activation latest:** Owner-approved preflight, local candidate installation/schema reload and installed rollback suite passed. Two eligible mention records copied preserving read state. Read-only browser confirms ready activity/bell separation. Live two-account event/read acceptance remains; no hosted activation. See QA_BATCH_5.md; earlier not-installed wording below is historical.

**2026-10-17 Batch5 latest:** Owner confirmed bell/social-original comments versus envelope/grouped Table activity, with read acknowledgments only for visible rendered content. Implementation, final source/offline/build and rollback DB suite passed; readiness/legacy fallback and360px header browser checks passed. Candidate NOT installed; preflight/activation/installed suite and live two-account browser acceptance remain. See QA_BATCH_5.md. Prior proposed/pending notification decisions below are historical.

**2026-10-17 Batch 4 update (latest):** Conversation presentation implemented without schema/access changes: distinct original comments/private Table reply audiences, question terminology, shared author/time metadata, London date dividers and active-count/removed-history explanations. Lint/types/offline/build plus read-only fixture/browser/phone/entry-target/unavailable-original checks passed; QA_BATCH_4.md records limits. Preview session39824 running, worker remains stopped. Next Batch5 notifications: settle proposed envelope/bell and read-state rules before implementation.

**2026-10-17 resumed photo acceptance (latest):** Agent browser Plate/chat/reply photo previews, selection removal, count/oversize errors, worker decode failure and valid retry passed with existing synthetic fixtures. Busy-caption bug corrected after branch confirmation; lint/types/offline/build/rebuilt browser passed. Worker stopped drained:true; preview session23753 running. QA_BATCH_3.md records new retained QA content, six untouched historical source-unavailable jobs and remaining forced slow-timeout/action-feedback scope. This supersedes real-photo-not-tested notes below for the exercised cases; next implementation Batch 4 conversations.

**2026-10-17 Batch 3 update (latest):** Forms/feedback built; final lint/types/offline/build passed. Fixture browser checks passed for link validation/parity, error clearing, bio/edit draft cancellation, ordinary route-link protection, Menu snapshot/revision hint, saved feedback and phone dialogue bounds. Local photo preview/removal/processing UI is implemented but real uploads and slow/failure acceptance remain; several mutation feedback paths also need acceptance. No schema/worker/owner/deletion changes. QA_BATCH_3.md records retained QA Plate/save and exact limits. Next owner photo acceptance, then Batch 4 conversations.

**2026-10-17 owner acceptance (latest):** Menu → Account → Your profile maintains the profile picture on all pages, owner-reported. Issue 23's navigation check passed, superseding the pending-check wording below. Expiry/signing/auth-switch cases remain separate. Next Batch 3 forms/feedback; no additional source changes or tests for this update.

Reviewed 17 October 2026. Planning only; no application, schema or data changes authorised or made by this review.

Source: owner's attachment `plates-qa-report(1).md` (46 findings, two QA passes), plus the owner's additional native browser dialogue finding, tracked here as **47**. The report's developer feedback is input to discussion, not approval to implement its suggestions. The original attachment and screenshot are unchanged.

## Owner decisions — 17 October 2026

**Batch 2 update:** identity/sign-in built; lint/types/offline account-UX/build passed and approved preview running. Fixture name edit/restoration across menu/profile/Table, name limits/cancel, curated invalid-code feedback, successful sign-in and unseen-tour routing browser-verified. Existing display-name RPC reused without schema. Header profile/picture lifecycle improved and a photo-bearing profile round trip loaded, but issue 23 remains partial pending the owner's own-photo header route check. No signup/completion resets/account deletion; QA_BATCH_2.md records exact limits and email-output correction. Next forms/feedback (Batch 3).

**Batch 1 browser result:** authorised agent testing passed picker/Enter/error clearing, fixed-row promotion/demotion, in-app confirmations/Cancel/keyboard, member removal/re-addition, ordinary leave, last-Admin handover/closure, two-session stale-target and duplicate-add handling, stale closure membership and 390/360px dialogue layouts. Read-only moderation menu showed explicit message-removal wording. Dedicated empty QA Table created then normally closed; no account/content deletion. QA_BATCH_1.md records evidence, state and limits. Next Batch 2 identity/sign-in; report 17 feedback lifetime remains Batch 3.

**Batch 1 implementation update:** owner authorised work and confirmed a non-default branch. In-app Table-management confirmations, role-independent member ordering, exact-username Enter handling, self/existing/duplicate selection feedback and explicit moderation wording are implemented locally. No schema/backend changes. Typecheck passed after fixing an action-union narrowing error; final lint/production build passed. Browser acceptance remains pending. QA_BATCH_1.md records exact scope and checklist. The report/decision alternatives below remain historical where superseded.

These later decisions supersede conflicting recommendations below; earlier alternatives are retained as discussion history.

- **2 private sharing:** checked and confirmed correct; preserve original readership guards and private placeholder.
- **1 membership:** keep immediate Table addition/full history as currently implemented. No mutual-follow requirement or invitation system. Fix picker/feedback/confirmation issues without silently restricting who may be added.
- **5 conversations:** owner delegates presentation direction. Proceed on the recommended two-audience model: original Plate comments versus private Table conversation/threads; clear audience labels and common message/reply metadata. No merging audiences or discussion records.
- **9 retention:** keep frozen Menu snapshots. No author-revocable-save redesign; preserve erasure handling and improve explanatory copy.
- **3 identity:** editable display name consistently primary, fixed username secondary, provided backend change stays small. Source inspection found an existing authenticated `public.update_display_name(text)` function and existing `profiles.display_name` column. The basic editor can reuse these; no new identity table/column/migration is expected for that feature. Validate installed availability and refresh behaviour during implementation; do not create a replacement backend by assumption. Existing snapshot attribution remains historical unless separately agreed.
- **13 notifications:** follow-acceptance and grouped Table activity accepted in principle. Owner suggests possibly an envelope icon beside the bell. The split below is a recommendation pending confirmation, not an approved new messaging system.

### Proposed bell / envelope split

| Header control | Contents | Unread treatment |
| --- | --- | --- |
| Bell — Notifications | Follow requests/new followers/follow acceptance and comments on original Plates | Existing event-level action/read state; no like notifications |
| Envelope — Table activity | Added to a Table, new Table messages, shared-Plate/Question replies and Table mentions | One grouped unread entry per Table, with mention emphasis, not a count per message |

Table mentions should move with their Table activity, avoiding the same event appearing/counting under both icons. Being added remains immediate; no accept/decline invitation event is introduced. Envelope is a Table-activity inbox, not a new DM feature. Existing Table/member access guards, duplicate/own-action suppression and read-through rules still need implementation scope/tests. Both controls need visible tooltips/accessible names and a phone-width layout check. No push/email requested.

**Next batch:** Table controls (6/7/16/18/47), then identity/sign-in. No app/schema/data changes in this decision-record update. Still separate scope: Table for two, photo-set editing, actual runtime test commands, any candidate activation and cleanup. Existing open-account pending-follow conversion is unchanged; no new behaviour was requested for issue 8.

## Latest result — private Plate sharing

17 October 2026: after the requested third-account check, owner reports “Privacy check is correct behaviour.” Supplied screenshot shows the Table share's separately authored note, a private-Plate placeholder requesting follow approval, and the Table discussion link; original Plate text/photos are hidden in the pictured card. **Issue 2: not reproduced / owner browser check passed; no privacy-preview change planned.** This is owner-reported acceptance, not an agent-run browser/API test. The screenshot alone does not independently establish discussion/gallery/direct signing or signed-URL expiry behaviour. Preserve existing access rules; broader API/media/revocation checks remain release acceptance work. Next Batch 0 work is the remaining product decisions.

## Assessment and evidence

The report supports the core journey working, while identifying substantial consistency, discoverability and feedback problems. Its High/Medium/Low labels mix bugs, prior product choices and new features; use the schedule below rather than treating every High item as a confirmed defect.

- **Private sharing concern 2 resolved for the owner's browser check:** no disclosure reproduced; screenshot matches the source's private-original placeholder. Preserve original-Plate access guards for Table cards, discussion pages and photo lookup. Broader direct API/media tests remain separate; any later reproduced disclosure would still be a release blocker.
- **Confirmed source issues:** native confirmations in Table management (7/47), inconsistent identity presentation and no display-name editor (3), exact-username picker/form behaviour (16/18), raw sign-in errors and Account landing (19/21), create/edit link mismatch and generic errors (10/20/25), date-free Table timestamps (14), and shared layout/navigation patterns behind several visual findings.
- **Reported, root cause unconfirmed:** scroll loss (12), avatar fallback on navigation (23), precise visual offsets/contrast, and some stale feedback states. Reproduce before choosing fixes. Signed picture URLs are short-lived and header loading is asynchronous; neither alone proves the avatar cause.
- **Prior product decisions requiring review, not silent reversal:** direct Table addition/full history (1), pending requests becoming followers when opening an account (8), retained Menu snapshots (9), separate original-Plate comments and private Table discussion (5), and fixed usernames (3).
- **Corrections:** role/member changes already confirm via browser dialogues; the sole-admin guard is present. Bell badge and its accessible text are present. Introduction redirects unseen accounts at Feed, but sign-in currently goes to Account. Testing a previously completed account does not prove the tour is broken. Unpublish already asks for confirmation.
- **Prior ledger versus this report:** previous owner acceptance was scoped. It does not close these newer findings. This report explicitly did not test phone widths below approximately 900px, fresh signup, signed-out direct links, account deletion or Close Table and leave. True mobile/release acceptance remains open.

Only local source/document inspection was performed for this review. No new browser, database, Storage, sign-in, worker, test/build, Git, dependency or remote operation was run. Runtime behaviour is attributed to the report, not newly verified.

## Proposed schedule

Work in this order, one reviewable batch at a time. These are sequential work blocks rather than calendar commitments; no start dates or daily availability have been agreed. Agree product decisions in Batch 0, then estimate implementation time from reproduced failures. A new private-messaging model, invitation system or photo-editing pipeline would materially extend the schedule and should be priced/scoped separately.

| Order | Work block | Scope and dependencies | Finish/review point |
| --- | --- | --- | --- |
| 0 | Verify privacy and settle product rules | Owner's privacy check passed; immediate membership/frozen saves/two-audience presentation accepted. Envelope split proposed; existing open-account rule unchanged. Fresh-account/accessibility checks still require their scope. | Core decisions recorded; settle notification presentation/read rules before its implementation. No privacy/membership/retention redesign needed. |
| 1 | Safe, consistent Table controls — browser verified | 6, 7, 16, 18, 47; lint/types/build and authorised browser/two-session/phone-width checks passed. QA_BATCH_1.md records evidence and limits. | Batch complete within recorded scope; next identity/sign-in. |
| 2 | Identity and sign-in — built/scoped checks passed | 3, 19, 21, 22, 23, 42; no schema needed. Source/build/offline and fixture browser checks passed; QA_BATCH_2.md records scope. | Own-photo header check (23), fresh signup/completed-tour returning acceptance remain; no admission weakening. |
| 3 | Forms, validation and saving feedback — built/scoped checks passed | 10, 15, 17, 20, 24, 25, 26, 28, 33; shared create/edit words/link handling, local attachment previews, processing states, counters, feedback lifecycle and guarded saved revision note implemented. QA_BATCH_3.md records evidence. Photo mutation in editing remains separate. | Real photo/slow-failure and remaining mutation feedback/privacy acceptance; browser history/programmatic navigation not universally draft guarded. |
| 4 | Make conversations understandable — built/scoped checks passed | 5, 14, 34, 40, 46 presentation: explicit audiences, shared author/time/reply treatment, question terminology, date separators and removed-count explanations. QA_BATCH_4.md records checks; existing access boundaries preserved. | Read-only/phone/entry-target checks passed; populated/removed comments, mutation/live/race/device/privacy acceptance remains scoped separately. |
| 5 | Complete notifications | 13, after Batch 0 event rules and Batch 4 destinations: follow accepted, Table added/invited and Table activity. | Recipient-only delivery/read counts/destination, duplicates, own actions and revoked access checked. |
| 6 | Navigation and page context | 11, 12, 27, 38, 39, 41; return scroll, loading the relevant Table message in context, honest temporary link wording, page titles/feed dates/end state/search thumbnails. | Navigate away/back from a long/paged list; locate older messages without losing context or exposing inaccessible content. |
| 7 | Visual and accessibility consistency | 29, 30, 31, 32, 35, 36, 37, 43, 44 plus the styling portions of 33/38/39/42. Fix shared components first, then individual pages. Actual accessible-name/contrast/focus defects move earlier when confirmed. | Desktop + genuine phone-width + keyboard review; no layout shift, unclear active/liked states or unnamed controls. |
| 8 | Release rehearsal and data inventory | All affected journeys and report's untested cases; inspect fixture inventory for 45, no automatic cleanup. Fresh lint/types/build after final code. | Owner reviews completed checklist and any remaining exceptions before hosted preparation. |

Batch 0 decisions can be discussed together. Batches 1 and 2 provide useful early fixes while more involved conversation/notification work is specified. Later visual work should use the final form/conversation patterns so we do not polish a layout twice. Cosmetic fixes can accompany their owning batch, but should not become a separate app redesign.

**Scheduling boundaries:** member invitation/consent, retained-copy behaviour, display-name changes and new notification storage may need additive database work and separately approved local activation. Every feature batch needs current non-default-branch confirmation before code edits. Git remains owner-run. Commands/tests receive the project's usual concrete scope approval; this plan itself authorises no execution or data deletion.

## Product decisions and recommended answers

### Table joining and a Table for two — 1, 4, 16, 18

Current immediate addition and full earlier history are deliberate implemented behaviour. They are not automatically a security bypass: an existing member/Admin is granting access to their own Table. They do create an unwanted-contact/consent issue worth deciding before alpha.

**Recommended alpha rule:** retain direct addition, but permit it only between mutually approved followers, with a clear added-to-Table notification and easy Leave. Checking only whether the inviter follows the recipient gives the recipient little control for open accounts. Enforce any chosen restriction in the database and in the picker, on both create and add, with privacy/follow revocation races tested. The tradeoff is that people must connect first. Existing memberships should not silently change.

If the intended experience is messaging any discoverable person, an accept/decline Table invitation is a better match and is larger work: pending membership, history withheld until acceptance, notification/read states, cancellation and erasure. Do not add both systems without a reason. Full earlier history upon joining should stay explicit; limiting it is another separate product decision.

**Table for two:** useful, but optional scope after the core fixes. A profile action could prepare a private Table with that person, still subject to the chosen consent rule. Before implementation, decide naming, duplicate/reuse behaviour, whether it can grow beyond two, and whether creation immediately adds or invites. Do not quietly invent a separate DM system or auto-create duplicate Tables on every click. Improve the member picker regardless.

### Private Plate previews — 2

A preview containing private text or photos is itself disclosure, even if the Open Plate link is denied. A shorter extract does not fix that privacy problem.

**Recommendation:** keep the existing original-Plate readership rule. Eligible readers can see the live Plate card; other Table members get a neutral private/unavailable placeholder. The sharer's separately authored note and the Table's own discussion follow Table membership. Their manually copied words cannot be recalled by the original Plate guard.

Verify using author A (private), approved follower B (shares), and non-follower C (Table member). Check C's fresh Table card, discussion, photo gallery, search, direct Plate reads and fresh image signing; then revoke B and repeat. Use source versus Table-uploaded photos distinctly. Existing signed URLs/delivered bytes require their separate expiry/cache test. If disclosure is reproduced, stop other feature work and repair the read path first. No test accounts/content are created by this document.

### Names — 3

**Recommendation:** editable display name as the main readable name everywhere; immutable `@username` as the secondary identity and mention target. Preserve the previously agreed choose-once username rule. Updating a display name must not change identity IDs, ownership or mention targets. Profile, chat, comments, notifications and menus should follow the same presentation rule, with responsive treatment when space is short. Frozen Menu attribution is historical snapshot content: decide explicitly whether its name is also frozen rather than rewriting old snapshots.

### Conversation model — 5, 34, 46

There are two audiences: current readers of an original Plate, and members of a particular private Table. Requests and shared-Plate threads are structured parts of that Table. The problem is that the interface makes these feel like four unrelated messaging products.

**Recommended first change:** keep the data/access boundaries and improve the presentation. Call original discussion “Comments on this Plate”; call private threads “Replies in [Table name]”; use “Ask the Table” for the action and “Question” in explanatory copy, while confirming the saved-Request label. Show the audience beside each composer. Give every message/reply a consistent author/avatar/time/edit/remove treatment and make returning to its Table context clear. Direct Plate comments must not be copied into the Table thread or Menu.

A side panel/in-context thread could later reduce page jumping. Merging all discussion into one stream is a larger product/schema change and could reveal private replies to the wrong audience. Do not merge merely to remove a page. Live refreshing of eligible original comments should be checked against existing update signals; the presence of a manual Refresh control alone does not prove comments never update.

### Open accounts and retained copies — 8, 9, 28

**Opening an account:** recommend retaining automatic conversion of pending requests. Before confirming, say that all signed-in people can view Plates and show the number of pending requests becoming followers; allow going back to review requests first. Opening then declining those requests would not prevent those accounts from reading an open account's Plates.

**Menu:** recommend keeping the agreed frozen-save model for alpha: ordinary edits/unpublish/privacy changes do not rewrite or revoke existing saves; fresh original access is checked separately. State this before saving and in author privacy/unpublish copy. Account erasure is separate and must continue clearing retained content through the existing process; this is no claim that arbitrary privacy changes erase saved copies or that all delivered media instantly disappears.

If the desired rule is author-revocable saves, stop and redesign the retention contract first. That affects existing saves, photo objects, source links, restores and wording; it is not a copy tweak. No automatic conversion/removal of existing copies. For “edited since saved,” show a revision comparison only to someone who can currently read the original; do not leak edit/activity information after revocation.

### Notifications — 13

Recommend: “Your follow request was accepted,” “You were added/invited to [Table],” and one grouped unread activity entry per Table rather than a bell notification per chat message. Resolve the added-versus-invited event after the membership decision. Include Table-thread replies/Request replies in the activity rule. Avoid own-action notifications, duplicate retries and double counting a mention plus the same message. Opening the Table can mark eligible activity read through a defined position; decide background tabs/visible Table behaviour explicitly. Removed membership/closed Table must suppress fresh context/destinations. No email/push in this scope.

### Confirmations, success feedback and unsaved work — 7, 24, 26, 35, 47

“Ask before” and “tell me it worked” are different needs. The report conflates them. Unpublish already has a confirmation; add a visible success outcome after navigating, rather than a second prompt. Bio save and follow acceptance need clear success state, not another confirmation. Menu removal should retain its existing reversible behaviour and feedback; restoring should be immediate with feedback unless a real consequence justifies a prompt.

Use one in-app confirmation pattern for consequential role/access/remove/leave actions. Name the target and effect; keep the target fixed while the operation runs; retain last-Admin protection. Use “Remove message” / “Remove message as Table Admin,” consistent with soft-removal semantics, rather than suggesting Admin rights are being changed or promising physical deletion. Label Cancel consistently where appropriate, with the primary button naming the action.

Counters should be added. For unsaved changes, start with an in-app dirty-form guard for Cancel/close/navigation and a browser unload warning where supported. Avoid promising universal interception of every browser Back or mobile close. The preview implementation should preserve edits/selections on failure and release temporary preview URLs when finished; no dependency is required for ordinary browser-decodable image previews. HEIC/HEIF needs an explicit unsupported-preview fallback or a separately scoped decoder, while preserving existing upload support.

## Complete issue register

Each report number is retained for traceability. “Source” means source evidence only; “verify” means the report is not newly reproduced. Work-block numbers refer to the schedule above.

| ID | Review / proposed action | Block |
| --- | --- | --- |
| 1 | Owner confirmed immediate addition/full-history behaviour stays. No new relationship/consent restrictions. Keep clear history wording; fix management/picker UX separately. | Decision settled; 1 UX |
| 2 | Owner reports third-account privacy behaviour correct; supplied card shows private placeholder, no original content. Not reproduced / browser check passed. Preserve guards; broader API/media checks separate. | 0 browser check complete |
| 3 | Owner accepts editable primary display name + fixed secondary username, conditional on small backend scope. Existing update_display_name RPC found; reuse without new identity schema. Preserve frozen attribution. | 2 |
| 4 | New convenience feature, not a broken promised DM system. Optional Table-for-two flow after membership/naming/reuse scope. Picker improvements remain core. | Optional after 1 |
| 5 | Owner delegates presentation direction; preserve two audience boundaries, unify labels/composers/reply treatment. No structural discussion merge. | 4 |
| 6 | Confirmed ambiguous moderation copy. Use explicit message-removal wording, not role-removal wording. | 1 |
| 7 | Report's “no confirmation” is inaccurate: source uses `window.confirm`. Replace native dialogues; keep targets and member order stable and protect last Admin. | 1 |
| 8 | Existing product rule. Recommend clear pending-request count/consequence and a way to review requests before opening; do not imply declining protects open content. | 0, 2 |
| 9 | Owner confirmed frozen Menu contract stays. No retention redesign; improve copy. Erasure remains a separate process. | Decision settled; 3 copy |
| 10 | Valid: edit's multiline Links field sends `not a link` to the server and catches generic failure. Give field/line-specific validation; distinguish bad link from stale revision. | 3 |
| 11 | Label/destination mismatch confirmed. Initially use honest “Open message” copy; full “View in Table” needs loading/highlighting the correct older position, beyond adding an anchor to an unloaded message. | 6 |
| 12 | Reported scroll loss; reproduce with browser Back and in-app link, paged Feed and image loading before choosing state restoration. Preserve the cursor and reserve image space. | 6 |
| 13 | Acceptance/grouped Table activity agreed in principle. Owner's possible envelope control is captured in proposed bell/Table-activity split above; confirm split and read rules before implementation. | 5 |
| 14 | Source shows time-only Table messages. Add chronological date separators plus full accessible date/time; use consistent timezone treatment. | 4 |
| 15 | Valid attachment-feedback gap. Add local previews/removal and honest staged/uploading/processing/sent states. Keep four-versus-six limits explicit; test slow/rejected jobs. | 3 |
| 16 | Confirmed picker does not exclude self/existing members. Exclude or explain unselectable entries, handle races/server no-op outcomes. | 1 |
| 17 | Clear field errors as their relevant input changes, clear cancelled flow state, and retire transient successes appropriately without hiding actionable failures or removing live announcements too quickly. | 3 |
| 18 | Username input is inside the create form. Enter should resolve/select a person, not accidentally create the Table; keyboard suggestions need their own accessible interaction. | 1 |
| 19 | Plausible UX bug, not proof admission is broken. Sign-in uses `shouldCreateUser:false`; an unknown address can yield Auth's signup-disabled error, which the UI displays raw. Friendly mode-specific copy; preserve denial and avoid revealing account existence unnecessarily. | 2 |
| 20 | Independent of hosting. Browser `type=url` rejects a bare domain. Normalize ordinary domain links to HTTPS in shared create/edit validation; retain HTTP(S)-only rules and server validation. Do not accept arbitrary scheme/script text. | 3 |
| 21 | Confirmed successful verification routes to Account. Prefer Feed, then existing missing-username/tour guards. Exercise signup as well as returning sign-in. | 2 |
| 22 | Not established for fresh users. Previously completed account should not repeat the tour; unseen Feed already redirects. Recheck truly unseen account after fixing 21, without resetting real users' completion. | 2 verification |
| 23 | Reported transient initials. Investigate async navigation, URL expiry/signing, failed image state and auth transitions. Preserve fallback/access checks, avoid permanent stale picture caching. | 2 |
| 24 | Split pre-action confirmation from post-action feedback. Unpublish already confirms. Add consistent success state; avoid confirmation for every harmless save/accept/restore action. | 3 |
| 25 | Unify create/edit labels and link limits. Adding/removing existing photos is a separate media/version/snapshot feature, with decisions and tests; not promised in the first form-consistency pass. | 3; optional photo-edit extension |
| 26 | Add visible/accessible counters and limit feedback, preserve drafts; scope dirty-form Cancel/close/navigation warnings. Browser lifecycle warnings have practical limits. | 3 |
| 27 | No dedicated Plate-title field exists. Prefer category/author context or a safely shortened first text line with category fallback for photo/link-only Plates. New required titles would be an unnecessary schema change. | 6 |
| 28 | Add “Original edited since you saved” only when current original access permits revision comparison; don't rewrite snapshots or leak inaccessible activity. | 3 after 0 |
| 29 | Fix singular/plural counts with one consistent helper/pattern. | 7 |
| 30 | Shared, stable-width tab presentation with visible/accessible active state. Treat “Your people” as navigation rather than a Search results tab. Preserve query on switching. | 7 |
| 31 | Header reserves account-action space inside a different effective content width. Use shared content alignment while preserving a reserved controls area and narrow-screen wrapping. Verify actual breakpoints. | 7 |
| 32 | Check computed fallback colours on dark Table header; set explicit readable foreground/background and validate contrast. Do not assume the picture itself is at fault. | 7; earlier if confirmed barrier |
| 33 | One saved-state pattern and wording across Feed/detail/Requests; preserve processing, saved and removed differences and access to View in Menu. | 3, 7 |
| 34 | Shared message metadata/spacing/removed-state treatment across contexts; preserve distinct audiences and ordering. | 4 |
| 35 | One dropdown/dialog style and consistent Cancel/action labels; migrate native/inline leave confirmations without changing safeguards. | 1, 7 |
| 36 | Make Save a secondary action; align Open Plate presentation. Separate hover from true liked state, including `aria-pressed`. Saving own Plates can remain useful; do not remove it implicitly. | 7 |
| 37 | Separate profile/bio from privacy visually, align action controls, keep tour actions in stable positions without fixed heights that clip long content/mobile zoom. | 3, 7 |
| 38 | Consistent heading hierarchy, one create-page heading and meaningful profile/manage browser titles. | 6, 7 |
| 39 | Add Feed timestamps/end state (an empty older page already has caught-up wording); guarded search thumbnails; style accessible upload controls. Separate these subitems and check performance. | 6, 7 |
| 40 | Current count excludes removed comments while placeholders remain by design. Label active-comment count and removed placeholders clearly; do not inflate counts or remove history to match a number. | 4 |
| 41 | People highlight on a profile is a defensible section-location cue; recommend keep it unless a My profile destination is introduced. Missing Table-error navigation should offer a reliable route out, compatible with the distinct Table shell. | 6 |
| 42 | Signed-out entry should have a quiet auth layout, unambiguous mode/heading and one primary action; preserve authenticated navigation elsewhere. | 2, 7 |
| 43 | A reserved unread colour can be intentional. Recommend define butter yellow as attention/unread (possibly processing) and check contrast; don't spread it to unrelated controls merely for repetition. | 7 decision |
| 44 | Verify accessibility tree, not visual absence of labels. Bell already contains sr-only “Notifications”; decorative avatars with adjacent names can correctly use empty alt. Check actual button/input names, standalone pictures, focus and announced states; fix confirmed gaps. | 0 audit, 7 fixes |
| 45 | Inventory synthetic accounts and associated content/objects, distinguishing fixtures still required by tests. No blanket purge or admin-list concealment. Exact-target cleanup plan and separate deletion approval; release dataset choice remains open. | 8 |
| 46 | Define terms at point of use and put audience beside composer, not just in the tour. Align Question/Ask the Table/Request naming and saved-reference explanation. | 0, 4 |
| 47 | Owner's added browser dialogue issue, overlapping 7/35. Screenshot specifically shows member removal; source also confirms role changes/leave use native prompts. Replace all related Table management prompts with in-app confirmations. | 1 |

## Acceptance and release gates

- Fixes need a fresh separate-account check; product choices need explicit owner agreement before implementation. No runtime tests have been performed during this review.
- Safety/access batches: open/private/approved/non-following/revoked/removed/closed cases and fresh reads/signing. Test concurrent membership/role changes and stale targets; preserve last Admin and erasure/restore hooks.
- Forms: create/edit parity, bad URLs, empty/limit/paste/cancel/retry, retained drafts, supported image preview fallback, slow/rejected photos, Menu snapshots and accessible feedback.
- Notifications: correct recipient, own-action suppression, grouping/unread/read, idempotency, current target access and erasure; no text/private activity leaked after loss of access.
- Navigation: older paged content, direct links, browser Back, late image loading and stable scroll; intended page/tab titles and active states.
- Accessibility: true narrow widths (for example 360/390px), keyboard-only operation, zoom, focus return, accessible names and contrast. Existing approximately 900px QA is not phone coverage.
- Fresh invited signup and ineligible-address denial, returning sign-in, unseen/completed tour, signed-out direct links; owner-scoped Close Table/leave and account-erasure tests using agreed disposable fixtures, never real accounts by assumption.
- Approved relevant lint/types/build after final code; affected rollback suites/installed candidate checks where needed. Browser acceptance on the production build. No dependency upgrade, Git operation, permanent DB activation or deployment follows automatically.
- Only then consider hosted preparation; SMTP/worker/erasure records/backup/restore/retention and managed migration integration are still separate outstanding work. This QA plan does not declare the app release-ready.

## First discussion / decision list

1. Private-Plate browser check passed per owner; keep existing rule and placeholder. No preview redesign needed for issue 2.
2. Membership settled: keep immediate addition/full history. Table for two remains optional/unapproved.
3. Retention settled: keep frozen saves and improve wording.
4. Presentation-first conversation approach delegated; grouped Table activity accepted in principle. Confirm proposed bell/envelope split and read rules before that batch; no structural thread merge.
5. Names accepted subject to small backend scope; existing update_display_name RPC meets the basic need in source. Photo-set editing remains separate/unapproved.

After those answers, commit a batch order and acceptance scope, then confirm a feature branch before editing source. The owner's QA data changes are not reverted by this review. No Git commands or cleanup commands are pending from this planning task.
