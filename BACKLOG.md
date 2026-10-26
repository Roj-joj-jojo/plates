# Plates — product backlog

Updated 2026-10-18. Backlog and implementation status: user-requested ideas are distinguished from recommendations and completed local work. Database activation, external actions and deployment require separate specific approval.

## End-to-end QA review — 2026-10-17

### Owner follow-up notes — 23 October 2026

Captured for the next session; implementation and runtime investigation have not started.

- **Worker hosting reconsideration:** owner no longer plans to use Railway after reported security concerns. Assess alternatives, including Cloudflare (owner’s candidate, already used for the domain), against the existing photo worker’s runtime/native-image requirements, secrets, limits, reliability and cost. No replacement selected or infrastructure change approved. Official incident evidence and distinction from unverified affected-user figures are recorded in ALPHA_HOSTING_RUNBOOK.md. Do not automatically resume older Railway setup steps.
- **Account organisation:** review which controls belong under profile, account and privacy; the current grouping feels misplaced to the owner. Agree the grouping before restructuring.
- **Privacy status wording:** the isolated “Open account” text on the profile remains after the Menu merge. Make its role as a privacy status clear and review its placement. This label was outside the prior Menu scope; no privacy/access-rule change is requested.
- **Desktop sign-in:** owner reports the initial login page feels fixed to a narrow/mobile layout on a PC. Review desktop proportions while retaining usable mobile layout and accessible form widths.
- **Removed items:** still too prominent in Menu. Owner suggests moving the secondary link right to the bottom of Saved; preserve existing search, restore and return behaviour.
- **Typography:** review font-size consistency across equivalent headings, body text, labels and controls; agree a coherent scale and check mobile/desktop readability.
- **Slow loading:** owner reports broadly slow page loads. Preview/branch deployment is a possible cause suggested by the owner, not an established diagnosis. Compare equivalent production and preview journeys and distinguish initial load from subsequent navigation before deciding on changes. Remote inspection or settings changes need separate authorisation.

Owner reports testing and merging the Saved/Your Plates change on 22 October; detailed acceptance coverage and the final merge revision were not supplied. These notes request follow-up, not automatic runtime, Git, publishing or data operations.

Visual follow-up latest (18 October): owner approved researched compact treatment. Content-level creation, below-search management link, compact filled navigation/three People views/Received-Sent, Plate heart-comment-bookmark and heading detail link implemented. Final lint/types/build/scoped browser passed; owner visual review next. QA_VISUAL_FOLLOWUP.md records scope/limits, including Feed phone not freshly exercised. Preview53804 running; no data/DB/Git/remote changes. Earlier Batch7 equal-width selected-underlined tabs superseded.

Batch7 latest (18 October): shared stable/current navigation tabs, aligned headers/phone Table controls, avatar contrast, secondary Save/distinct liked styling, bounded menus/dialogs and opener focus return, picture chooser, singular announcement and stable introduction grid implemented. Final lint/types/build and scoped desktop360/390/keyboard/query/contrast/short-dialog browser checks passed. QA_BATCH_7.md records exact scope/limits. Preview2550 running; worker not operated. Next Batch8 integrated rehearsal and retained-fixture inventory; >50 context/posting/follow acceptance and earlier limits remain. No data cleanup/Git/DB/remote actions.

Batch6 latest: navigation source query/cursor/card return, dates/end state/content heading, guarded thumbnail, message/reply context, profile/manage titles/create subsection built; final source/offline/build and scoped read-only browser/phone checks passed. QA_BATCH_6.md records older-history/posting/comment/pixel/performance/privacy limits. Preview33743 running; worker stopped. Next Batch7 visual/accessibility.

Batch5 browser latest: scoped two-account addition/message/mention grouping, bell split, list retention, visible clearing/unseen thread reply protection, reverse delivery/self suppression and native Firefox background behavior passed. QA Table/content retained, follows/privacy unchanged. QA_BATCH_5.md records limits; next review outstanding acceptance then Batch6 navigation.

Batch5 activation latest: owner-approved preflight/local notification candidate install/API schema reload/installed rollback suite all passed. Two eligible mentions copied preserving read state. Read-only ready activity/bell separation checked; live two-account acceptance remains. Candidate outside managed migrations; do not reinstall. See QA_BATCH_5.md.

Batch5 latest: confirmed bell/envelope split and visible-rendered read rules built; source/offline/build/rollback database checks passed. Read-only readiness/legacy fallback and360px header checks passed. Candidate NOT installed; live acceptance pending separate preflight/activation/installed-suite approval. Preview65569 running; worker stopped. QA_BATCH_5.md records exact scope/limits.

Batch4 latest: explicit original-comment/private-Table audiences, shared author/avatar/handle/time metadata, London date dividers, question/Post question wording and active/removed count explanations built without schema. Source/offline/build/read-only fixture browser and phone checks passed. Preview session39824; worker remains stopped. QA_BATCH_4.md records limits; no data/owner/Git changes. Next notifications after settling proposed envelope/bell/read rules.

Resumed photo acceptance latest: synthetic Plate/chat/reply preview/removal/send, count/oversize errors and failed decode→valid replacement passed in browser. Busy-caption correction passed lint/types/offline/build/rebuilt browser. Worker stopped drained:true; preview session23753 running. New QA content retained; no cleanup/owner/schema/Git changes. QA_BATCH_3.md records limits; forced slow-timeout and remaining action feedback still separate. Next implementation Batch 4.

Batch 3 latest: shared validated/normalized links and ten-link create/edit parity, local photo previews/removal, progress, counters, feedback lifecycle, saved-control consistency, separate bio/edit-discard guards and guarded Menu revision note implemented without schema. Final lint/types/offline/build and scoped fixture browser checks passed. Real photo upload/slow-failure and some mutation feedback acceptance remain. Preview session81580; QA_BATCH_3.md records retained QA Plate/save and limits. Next owner photo acceptance, then Batch 4 conversations.

Latest owner acceptance: all pages maintain the profile picture through Menu → Account → Your profile. Issue 23's navigation check passed; earlier owner-check-pending notes below are superseded. Expiry/signing/auth-switch testing remains separate. Next Batch 3 forms/feedback.

Batch 2 built/checked: existing-RPC display-name editor, consistent primary name/secondary handle, quiet sign-in/curated errors/Feed entry and shared header-avatar state. Lint/types/offline/build passed; fixture name edit/restoration and sign-in/unseen-tour browser checks passed. Own-photo header issue 23 remains partially verified; owner route check needed. Preview running; no schema/account creation/deletion or owner changes. QA_BATCH_2.md records limits. Next forms/feedback.

Batch 1 browser verification passed: authorised agent checks covered picker/Enter, confirmations/focus/keyboard, stable role changes, add/remove/leave/handover/closure, two-session stale/duplicate actions and 390/360px dialogues. Dedicated empty QA Table created then normally closed, no account/content deletion. Read-only moderation wording verified. Details/limits in QA_BATCH_1.md; next identity/sign-in. Feedback lifetime remains report 17 / Batch 3.

Batch 1 implementation: owner authorised and confirmed non-default branch. Table-management in-app confirmations, stable role-independent member ordering, exact-username Enter/picker exclusions and explicit moderation removal wording built locally; lint/typecheck/production build passed, browser acceptance pending. Existing backend/admission/join/history rules unchanged; no schema activation. See QA_BATCH_1.md.

Owner decisions: retain immediate Table joining/full history and frozen Menu saves; private sharing check accepted. Delegate two-audience conversation presentation improvements. Editable display name/fixed username accepted if backend small; existing `update_display_name` RPC can support basic editor without new identity schema. Follow-acceptance/grouped Table activity accepted in principle; envelope beside bell is suggested, with proposed audience/event split in QA_REVIEW_PLAN.md, not a new DM feature. Next batch Table controls, then identity/sign-in. No implementation in this update.

Privacy update: owner reports requested third-account check behaves correctly; screenshot shows a private-Plate placeholder rather than original content. Issue 2 not reproduced / browser check passed, no preview redesign planned. Preserve original readership guards; broader API/media/revocation/expiry acceptance stays separate. Remaining product decisions and QA work batches are unchanged.

Owner supplied 46 findings plus native Table-management browser dialogues (47). QA_REVIEW_PLAN.md is the current issue-by-issue assessment, decision list and proposed batch schedule. Source/document review only; no app/schema/data changes or new tests. Some findings describe prior product decisions or new features, and others are unconfirmed/corrected; do not treat the report's developer notes or proposed schedule as implementation/deletion approval. First settle privacy/membership/retention/conversation rules, then work through the batches and repeat affected acceptance. Earlier scoped browser passes remain historical evidence, not full release acceptance.

## Browser findings and new requests — 2026-10-15

Menu removal browser acceptance: owner reports all requested Plate/Request removal, Undo, refresh/Removed-items Restore and intact photo/content checks passed. Local feature slice complete; broader release/privacy/concurrency/hosted gates remain separate. Earlier browser-pending notes below are historical.

Menu removal activation: owner approved guarded installation of 20261015000300 and installed rollback checks; all passed. Remove/Undo/Removed-items Restore now has local backend support. No real saved items removed. Owner restart/browser acceptance next; earlier candidate-not-installed notes below are historical.

Menu removal update: owner approved reversible Remove/Undo/Removed-items Restore for saved Plates and Requests. UI/source-page restore, filtered lists/search and candidate 20261015000300 built locally; lint/typecheck/runner syntax/rollback fixture checks/production build passed. Candidate remains NOT installed; explicit local activation and browser review are next. No actual saved item, record or file deleted. See MENU_REMOVAL.md. Earlier removal-proposed notes below are historical.

Owner browser acceptance: all three implemented changes passed the requested review. Owner subsequently identified missing Menu removal. Reversible Remove/Restore for personal saved Plates/Requests is proposed; exact removal/re-save semantics not confirmed and no implementation or deletion performed. Preserve original content, other people's saves and erasure precedence.

Activation update: owner explicitly approved local preflight/install/installed checks. Both follow-notification and Menu-gallery candidates installed successfully; installed-schema rollback fixture suite passed. No pending requests existed to capture at installation. Unavailable-page/new notification/multi-photo save browser acceptance is next after owner restarts the already-built app and dedicated photo worker. Earlier activation-pending notes below are historical.

Implementation update: owner approved proceeding. Custom unavailable page, follow-notification UI/bell, all-photo Menu save/display code and two additive SQL candidates are built locally. Lint/typecheck/production build and specifically approved rollback-only notification/gallery/erasure fixtures passed. Candidates remain outside migrations and NOT activated; browser/live gallery acceptance and explicit local activation are next. See SOCIAL_MENU_UPDATES.md. Earlier unimplemented/not-fixed wording below describes the findings before this work.

- Owner reports Plate/Table/Menu photo display, private Plate denial, non-member Table denial, signed-out redirect, follower revocation and retained Menu copy tests passed. Viewer close/control text contrast fix also accepted. This is owner-reported browser evidence, not comprehensive direct API/Storage signing/cache-expiry or concurrent-access verification.
- **Unavailable-page appearance:** denied private Plate produces a white/washed-out 404; denied Table produces a blacked-out 404. Investigate and provide a readable, consistent unavailable page without disclosing whether restricted content exists. Not fixed yet.
- **Notifications:** owner wants interactions requiring action surfaced through the bell, specifically incoming private-account follow requests, plus informational new-follower notifications. Requests should lead to a clear approval/decline path rather than being discoverable only under People. Mentions remain supported. Other event types and release priority need scoping; this does not supersede the existing no-like-notification decision. No implementation or schema activation yet.
- **Complete saved Plate imagery:** owner requests all pictures of a multi-photo Plate in the saved Menu preview. Current source loads one generated preview per save. Preserve saved body/links/attribution and saved-photo retention after ordinary privacy changes or follower removal; do not fetch newly inaccessible originals to fill the gallery. New preview storage/worker/erasure behaviour and treatment of older saves need design before implementation. Do not assume missing historical images can be recovered after source access is lost. No change or data backfill performed; release priority unassigned.

2026-10-14 status clarification: owner approved and requested the open/private following model. Social UI is built and the specifically approved migration is applied locally. Candidate and installed rollback SQL, final lint/typecheck and Tailwind compilation passed. Owner reports Account privacy working and approves the header/navigation appearance after the icon refinement; exhaustive social/browser/device verification remains pending. See SOCIAL_ALPHA_PLAN.md. Other backlog entries remain proposals/unimplemented unless separately noted.

## Next discussion: interactions on Feed Plates

2026-10-15 implementation and activation: owner approved likes/comments and explicit limits (self-like allowed, flat plain text up to 2,000 characters, newest-first, removal placeholder/no Undo, author erasure). Feed/detail interactions, comments/edit/moderation/pagination and Plate-author comment notifications are built locally. Candidate 20261015000400 is installed locally and remains outside migrations. Owner-approved lint/typecheck/runner syntax/rollback-only privacy/idempotency/notification/erasure suite, final production build, preflight and installed-schema rollback suite passed. App/worker stopped for checks. Browser and true concurrency acceptance next; see PLATE_INTERACTIONS.md. Older unbuilt/discussion-only wording below is historical.

2026-10-14 morning decision: owner requires likes and simple direct Plate comments for the first alpha. Approved audience is everyone who can currently read the Plate; comments share that audience. People may edit/remove their own comments, and the Plate author may remove comments on their Plate. Notify the Plate author about new comments, without like notifications. Removed text is hidden and account erasure must cover the new records. No feature/schema implementation or activation this morning. See ALPHA_RELEASE_PLAN.md for ordered work, recommended limits and release gates. The earlier discussion-only wording below is historical and superseded by this decision.

Owner asked to pick this up tomorrow. Current Feed cards offer Save to Menu and Open Plate; the Plate page offers Share to a Table and author editing/unpublishing. Discussion is currently inside a Table share's thread. Direct Plate likes/reactions and comments are not implemented.

Scope likes and direct Plate comments before building: decide release priority, comment audience under open/private accounts, moderation/removal, retained context after privacy changes and notification triggers. Keep direct Plate comments distinct from private Table discussions. This request is to discuss the feature next, not authorisation to implement/activate a new interaction schema tonight.

## Alpha: first-run introduction

2026-10-15 browser acceptance: owner reports all requested first-Feed/navigation/dismissal/persistence/replay/shortcut/narrow-layout/keyboard/second-account checks passed and approves appearance. Local feature slice accepted after prior build/installed checks; integrated release acceptance and hosted preparation next. Earlier pending notes below are historical.

2026-10-15 activation: owner separately approved the single candidate. Preflight passed, local installation committed, installed-schema rollback suite passed; no real completion choices set. Browser/mobile/keyboard acceptance next; app/worker not restarted by agent. INTRODUCTION.md records exact scope. Candidate remains outside migrations; older inactive notes below are historical.

2026-10-15 implementation: owner approved building the walkthrough. Five-step introduction, synthetic previews, Back/Next/Skip/Finish, account persistence and Account replay are built locally. Candidate 20261015000500 remains outside migrations/NOT installed. Source/type/runner, rollback-only isolation/retry/disabled/erasure checks and final production build passed. Separate activation and browser acceptance next; see INTRODUCTION.md. Older recommended/unbuilt wording below is historical.

Navigation decision, 2026-10-14: Feed, Tables, Menu, Search and People are the five main destinations. Notifications (bell) and the profile/account menu live in the black header. This navigation is implemented locally; Notifications currently contains mentions only. Future notification types requested by the owner—Plate comment activity, Plate sharing activity and replies to Requests—remain backlogged, with trigger/audience rules to be designed before implementation.

Owner requested a brief, designed, dismissible introduction to the app.

Recommended scope:
- Explain Feed (browse Plates), Plate (a meal, recipe or place), Table (private conversation) and Menu (saved Plates and Requests), with small synthetic previews.
- Offer Back, Next, Skip and Finish; keep the walkthrough keyboard-accessible and readable on mobile.
- Remember completion/dismissal per account and offer replay in Account. Account persistence requires a separately reviewed storage change; it is not currently implemented.
- End with useful links to find people, create a Table or publish a Plate. Demo content must not create actual contributions.

## Alpha: finding and connecting with people

Owner identified the missing social discovery/friends-list flow for an initial 10–15-person alpha. The subsequently approved open/private following model is implemented locally, with acceptance work still outstanding.

Owner decision, 2026-10-13: following authors and a Feed selected from those follows are required before alpha release. User discovery belongs in Search. The current app-wide Feed is a prototype fallback and is not sufficient alpha acceptance. This supersedes the earlier recommendation to retain it for alpha. Acceptance/reciprocity details and whether following changes direct Plate viewing permissions still need agreement; Feed filtering alone does not create private Plates.

Subsequent confirmed decision: accounts default open, with immediate one-way following; accounts can be made private, requiring follow requests/acceptance. Private Plates are accessible only to their author/approved followers, including in Search, direct links, Table previews and photo signing. Names/usernames/pictures remain discoverable. Existing followers stay approved when switching to private; opening approves pending requests after confirmation. Previously captured Menu copies remain. Table membership is separate. This supersedes the unresolved/recommended relationship and Feed-viewing notes below; detailed implementation/verification is in SOCIAL_ALPHA_PLAN.md.

Confirmed current behaviour:
- Owner-managed email admission permits signup; it sends no invitation message and creates no social connection or Table membership.
- Accounts choose unique usernames. Table Admins can select an existing person by exact username and add them immediately, with access to earlier conversation.
- Feed now shows available Plates from approved followed authors plus the viewer's own Plates, with pagination. Open authors remain discoverable through Search/profiles; private originals require approval.
- Following, Followers, Requests and Sent requests are implemented under People. This is directional following, not automatic mutual friendship.

Earlier recommended scope — historical; superseded where it conflicts with the confirmed model above:
- People discovery within Search using usernames/display names, with visibility rules explicitly settled before implementation; no email directory or automatic connection based on admission.
- A small “Your people” list with connection requests, acceptance and removal. Show pending requests there; do not silently repurpose Mentions.
- Let Table creation/management select connected people while retaining exact-username lookup. Connections alone must not grant access to private Tables.
- Preserve the existing immediate Table-addition behaviour unless the owner separately chooses Table invitations/acceptance.
- Build Follow/Unfollow and a chronological Feed selected from followed authors before alpha. Settle own-Plate inclusion, empty/no-follow states and relationship semantics before implementation; do not assume mutual friendship or acceptance requirements.
- Verify separate-account discovery/request/acceptance, private Table access, departure and account-erasure integration before alpha release. New relationships and discovery permissions require reviewed backend work and specific migration approval.

Suggested alpha journey: owner allows signup and shares app URL → person signs up and chooses a username → finds/connects with another person → Table Admin adds selected people → members talk, share Plates, reply and save to Menu.

Alpha acceptance must exercise distinct follow lists across separate accounts, Follow/Unfollow changing Feed selection, no-follow/empty states, and unchanged private Table access. Testing only an app-wide Feed does not validate this journey.

## Backlog: recipe-link imagery

Owner requested a URL thumbnail preview or a picture attachment alongside a recipe link when publishing/sharing a Plate. Release priority remains unassigned.

- Manual photo attachments already exist; review whether the recipe-link publishing/sharing UX makes that path clear enough.
- URL-derived thumbnail/link previews are a new feature. Define fetching, missing-image fallback and how previews behave in Table shares and captured Menu reminders before implementation.
- Do not treat an automatically fetched preview as recipe extraction or silently change saved-copy semantics.

## Far future: camera ingredients → saved Menu ideas

Owner proposed AI camera recognition of available ingredients, linked to relevant items already saved in the user's Menu. Explicitly far future, outside alpha/beta commitments.

- Let the user review/correct recognised ingredients, then suggest matching saved Menu items.
- Model/provider, image handling and matching approach remain unspecified; no external service, image transmission or AI dependency is selected or authorised.

## Beta: regular starter content

Owner proposed posting a batch of Plates weekly from the admin account to keep the Feed populated.

- Manual publishing already exists and can supply starter content before alpha opens; it does not require a new feature.
- Scheduling/draft batches or a curated-content workflow are possible beta enhancements, with exact requirements still open.
- No recurring automation, external publishing or synthetic content upload is authorised or configured by this backlog.

## Suggested sequence

1. Finish separate-account browser acceptance of the built following/privacy flow; discuss direct Plate likes/comments and their release priority next.
2. Build the first-run introduction around the finished interaction flow.
3. Owner supplies starter Plates and verifies the journey with separate accounts before alpha deployment.
4. Revisit weekly publishing tools for beta.

## Previously deferred

### Product-document inventory — clarified 2026-10-13

The owner clarified that their original request was for the backlog already in the product documentation. Sources: MVP_SCOPE.md, PRODUCT_MODEL.md, USER_JOURNEYS.md, DATA_MODEL.md, PRODUCT_DISCOVERY.md and INVITATIONS_ADMIN_PLAN.md. These documents include historical proposals and outdated implementation status; the list below preserves that distinction.

Planned gaps or unresolved product directions:
- Following authors and a feed selected from those relationships: required before alpha and implemented/activated locally under the subsequently approved open/private model; complete remaining browser acceptance before release.
- Promote an author's own Table contribution into an editable Plate draft, with an explicit audience review.
- Create a linked Recipe Plate from an existing Meal Plate, retaining both contributions.
- Table archiving: exact read/write/reopen behaviour remains open; existing closure is a different operation.
- Reactions and notifications beyond current in-app mentions; broader notification behaviour remains unspecified.
- Ingredient-led discovery with optional ingredient information and improved matching. Ordinary keyword searching already exists; this is a richer research direction.
- Combined search across multiple accessible Tables; not yet agreed.
- Save individual Table messages/replies or arbitrary discussions. This remains unresolved, rather than approved scope; formal Request saves already work.

Explicitly deferred or excluded from the baseline:
- Personal Menu collections/subcategories (Taster Menus is an unconfirmed name).
- Requests broadcast to the Feed.
- User-facing blocking/reporting, with shared-Table behaviour still to define.
- Private author profiles/follower-only Plate visibility: originally deferred, subsequently approved and implemented locally as an optional privacy setting; no longer an outstanding feature.
- Historical Plate-version browsing.
- Share to multiple Tables in one action.
- Automatic tag suggestions, image recognition, semantic search and automatic recipe/ingredient extraction.
- Maps and deeper restaurant integrations.
- Threads from arbitrary messages, nested threads and automatic whole-thread Menu copies.
- Apple/Google sign-in.
- Paid tiers/subscriptions: a future concept, with no selected plan or provider.

Research questions, not committed features: cooked/visited/want-to-try activity states and lists, ingredient synonyms/multiple-ingredient search, and distinguishing cooked recipes from merely shared links.

Do not count the historical Realtime, photos, Requests, mentions, content controls or Table Admin/membership deferrals as current feature gaps: these have since been implemented locally. Earlier Table invitation acceptance was explicitly superseded by immediate Admin additions. Release/device verification is separate from feature implementation.

Feed visibility clarification: src/app/feed/page.tsx requests the newest 30 available Plates without author/relationship filtering. Migration 20261006000200 defines plates_read for any authenticated active app profile. Thus the current prototype uses an app-wide signed-in Feed, not a friends/following Feed. This is source/policy inspection, not a fresh live two-account test. The earlier proposed choice to retain that Feed for alpha is not an agreed product decision.

2026-10-14 correction: the preceding Feed clarification describes the earlier prototype. Current source calls `following_feed`; open/private following is activated locally and the Feed is relationship-selected as described at the top of this backlog. Browser acceptance remains separate.

- Draft recovery across reload/reconnect remains low priority, as previously requested; normal live-update draft retention is separate.
- Older product scope also defers Menu collections, multiple-Table sharing, semantic search/recipe extraction, maps and detailed reactions. Those historical proposals are not newly authorised by this discussion.
