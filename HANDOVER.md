# HANDOVER.md — Project Working Ledger

Last updated: 2026-10-04

## Quick project summary

Plates is a planned food-centred social application where people can share food photos, recipes, reviews, and trusted recommendations with friends and people they care about. The initial focus is a mobile-friendly website with private Table conversation, a feed, and personal Menu saves. The selected stack is Next.js, TypeScript, Tailwind CSS, Supabase (PostgreSQL/Auth/Storage/Realtime), with Vercel for eventual hosting. Maps and deeper restaurant integrations remain later work. See `STACK.md` for the first build sequence and setup status.

- Canonical GitHub repository: `https://github.com/Roj-joj-jojo/plates`
- Repository access and all Git operations remain under the project owner's control.

## Current logic and state

Describe the current working state of the project and how its important parts fit together. Keep this section current so a new session can regain context quickly.

- Current area of focus: Beginning the local prototype; the owner explicitly does not want further wireframing to block implementation. Reconcile confirmed decisions, then scaffold after branch/setup approval. Use `Tables` for app groups and `records` for stored entities.
- Current behaviour: No application implementation is currently present in the local project folder.
- Important components and relationships: Each Plate share and formal Table Request has its own thread. Menu holds captured Plate reminders (one per saver/Plate, multiple explicit source links, no refresh on re-save) and Request saves that open ongoing threads under current membership rules. Shares show current Plate content plus `Edited since shared`; snapshots remain unchanged. Ordinary Plate removal preserves reminders; account/intervention removal can remove saved copies, with detailed policy open. Individual-message saving is unresolved. Tables stay private; author-profile privacy, feed Requests, personal collections and user-facing blocking/reporting are deferred for the initial friends-only release.
- Confirmed working: The private export can be linked to local media by filename, and the aggregate research record contains no copied source media, participant names, or direct quotations.
- Not yet working or not yet verified: Plate and Request flows have reviewed wireframes but no usability tests. The stack is selected; no app, physical schema or installed dependencies exist yet. The current shell cannot find Node/npm. Active feature branch and local installation/verification permission have been requested and not yet confirmed.

## Active work

- Current task: Prepare and begin the mobile-friendly local app foundation. The owner approved continuing with the selected stack and wants implementation progress.
- Current status (2026-10-04): Reconciled the planning documents with later conversational decisions and created `STACK.md`. The inspected project still contains only Markdown files. `node --version` and `npm --version` both returned command-not-found. Awaiting owner confirmation of the active non-main branch and dependency/verification permission before app edits or installs. Runtime setup needs resolution; no Git operations or cloud actions occurred.
- Files or areas involved: `STACK.md`, `PRODUCT_MODEL.md`, `MVP_SCOPE.md`, `DATA_MODEL.md`, `USER_JOURNEYS.md`, `HANDOVER.md`; research context in `CHAT_RESEARCH.md` and `PRODUCT_DISCOVERY.md`.
- Latest data-model state (2026-10-04): Product decisions above are confirmed; the revised logical draft proposes common timeline entries and a thread/reply structure to support shares and Requests without parallel nullable reply targets. Typed media relationships, source/Plate integrity and removal tracing are design requirements for the physical schema. Exact snapshot fields, membership-change and account/intervention removal rules remain open. No SQL has been applied or tested.
- Latest design progress (2026-09-28): Close-ups extend the feed-to-Table-thread wireframe through saving the shared Plate to the Menu and returning to that particular discussion. The owner confirmed original authorship at the top of the saved item; the Table sharer alongside its source Table and explicit `View Table discussion` link; and saving in place with a `Saved` confirmation rather than automatic Menu navigation. The saved item is the Plate, not a reply or whole thread. Individual-message saving remains a separate interaction to discuss.
- Latest research (2026-09-28): A third sea-bass respondent relies on keyword search, would ideally retain recipe and photo together, and values the personal connection. This supports existing retrieval/source-context decisions and suggests testing a related Plate/photo preview alongside a saved recipe reply. That preview is a proposal, not a confirmed MVP requirement; current save rules and scope remain unchanged.
- Latest clarification (2026-09-28): The owner distinguished a shared Plate's discussion thread from arbitrary message threads and from saving an individual message. Only shared-Plate threads are established by the wireframe. General message-thread creation, nested threads, and whole-thread saving are not agreed. The intended recipe example saves one reply from an existing Plate thread without creating a new thread, but the owner has not yet considered that single-message interaction or its Menu presentation. Discuss it before extending the wireframe or adding the proposed related-photo preview.
- Intended outcome: A working local Plate → Table → reply → Menu loop, followed by formal Requests and the other agreed MVP capabilities. Earlier dated design notes below are historical context; the October 4 summary supersedes their unresolved Request/repeat-save wording.

## Decisions and reasoning

Record material decisions that future sessions should preserve or reconsider deliberately.

| Date | Decision | Reason | Status |
| --- | --- | --- | --- |
| 2026-09-22 | Position Plates around trusted food sharing and recommendations from friends rather than anonymous reviews or algorithmic content. | The owner's existing “Dinner time” group chat demonstrates that people already exchange food photos, recipes, requests, and recommendations within trusted social groups. | Confirmed |
| 2026-09-22 | Use one flexible core content object, provisionally called a `Plate`, rather than separate posting systems for photos, recipes, reviews, and recommendations. | A common object keeps posting and the feed simple while allowing optional structured details and later expansion. | Confirmed |
| 2026-09-22 | Treat close friend groups that already discuss food in group chats as the initial audience. | This is an observed behaviour and a concrete founding use case, reducing reliance on a hypothetical audience. | Confirmed |
| 2026-09-22 | Include private `Tables` with Discord-style persistent group conversation in the MVP. | Plates must preserve the spontaneous social conversation of existing food group chats rather than becoming only a feed of structured posts. Discord is an interaction reference only, not an integration or dependency. | Confirmed |
| 2026-09-24 | Treat text, URLs, and images as equally important primary ways to share food information. | Requests and recommendations often work without images; recipes, maps, venue links, and the friend's explanation can carry the core value. The owner explicitly confirmed that Plates must not drift into a purely food-image platform. | Confirmed |
| 2026-09-25 | Define the boundary of a `Plate` through deliberate publishing action rather than its format, completeness, or metadata. | The same photo, URL, recipe, or description may be casual Table conversation or an intentional feed contribution; authorial intent is the meaningful distinction. | Confirmed |
| 2026-09-25 | Allow Plates to be referenced across multiple independent `Tables`. | A Plate is a portable social object that people can bring to the group with whom they want to discuss it; Tables also exist for ordinary conversation unrelated to a Plate. | Confirmed |
| 2026-09-25 | Treat a personal `Menu` for saving and categorising useful Plates as an important product capability. | Trusted food content should remain useful after discovery, including recipes, restaurants, ingredients, and other things someone wants to revisit. Its exact MVP design remains open. | Confirmed direction; scope open |
| 2026-09-25 | Make saving to the `Menu` immediate and automatically categorise the saved Plate, with optional user-created collections. | Saving should preserve the moment of inspiration without an organisational step, while later categorisation makes Plates a useful cooking and food resource rather than a transient feed. | Partially superseded: immediate saving and collections remain confirmed; categorisation perspective clarified below |
| 2026-09-25 | Do not require the publisher to choose a single content category; allow a Plate to be useful through multiple receiver-centred lenses. | The same sea-bass Plate can be appreciated socially, remembered as an ingredient idea, or saved for its recipe. A later scenario suggested that the original may reasonably be categorised as a meal while the recipe supplied through conversation becomes the thing worth saving. | Reopened for testing; multi-category usefulness remains valid |
| 2026-09-25 | Let an author promote their own Table material into an editable Plate draft rather than copying it directly. | Useful content often emerges through conversation; promotion should reduce performance pressure while letting the author make the durable contribution more definitive. | Confirmed journey direction |
| 2026-09-25 | Allow Requests to be posted in a Table or deliberately broadcast through the feed, with replies remaining where the Request was posted and no mandatory resolution. | Questions are a core food interaction, but separate conversations need not be globally aggregated and different levels of follow-up should remain valid. | Confirmed journey direction |
| 2026-09-25 | Treat app-wide search across accessible content as the longer-term direction while keeping the MVP free from mandatory exhaustive tagging or image-based classification. | Menu retrieval should be dependable for saved material; broader search can use available text and metadata and accept that sparse images may be difficult to rediscover initially. | Confirmed direction; MVP scope open |
| YYYY-MM-DD |  |  | Confirmed / Proposed |
| 2026-09-26 | Allow direct Menu saves of useful Table contributions alongside Plates, including replies that never become Plates. | A recipient must be able to retain a useful recipe or explanation without waiting for its author to publish or enrich a Plate. The owner explicitly confirmed this after reviewing the first sea-bass responses. | Confirmed |
| 2026-09-26 | Show saved Table content and its author, with an easy action back to the original contribution in its source conversation. | The Menu should make saved material useful directly while letting people recover its conversational context. The owner cited Slack as an interaction reference, not an integration. | Confirmed |
| 2026-09-26 | Proceed with product definition without waiting for further sea-bass responses. | The owner will continue gathering feedback, but it should refine the working model rather than indefinitely delay decisions. Untested choices remain explicit and revisable. | Confirmed |
| 2026-09-26 | Use threads for Plate discussions within Tables. | The owner explicitly selected a threaded discussion model. Each discussion remains within its own private Table. | Confirmed |
| 2026-09-26 | Support searching accessible Plates, including by author name, and searching within Tables the user belongs to. | People should be able to recover previous contributions without a prior save or mandatory tags, while Table content stays private to its members. | Confirmed |
| 2026-09-26 | Allow Plates to be published without extra tags or information, with optional tags to help discovery. | Low-friction posting and richer discoverability should both be supported. Tags must remain optional. | Confirmed |
| 2026-09-26 | Defer content-based tag suggestions beyond the initial version. | The owner considers suggestions desirable but unlikely to belong in the MVP. Manual optional tags and author-name retrieval establish a simpler starting point. | Provisional MVP deferral |
| 2026-09-26 | Require a broad category when publishing a Plate; keep extra tags optional. | The owner clarified that low-friction posting still includes a category such as Meal, Recipe, or Restaurant. This supersedes the earlier no-required-category interpretation and resolves the reopened publisher-category question. | Confirmed; exact category list and multiplicity open |
| 2026-09-26 | Use broad categories for initial Menu organisation and defer extra personal subcategories or collections beyond MVP. | The owner regards personal organisation as useful but additional to the first version. Categorisation of saves from ordinary Table replies still needs clarification. | Confirmed |
| 2026-09-26 | Include basic image browsing within a Table in MVP. | The owner confirmed the visual rediscovery and inspiration use case, citing WhatsApp's chat media view as an interaction reference only. | Confirmed |
| 2026-09-26 | Keep an existing Plate category when saving; ask the saver to choose a broad category for an uncategorised Table reply. | Both save types can be organised in the Menu without requiring categorisation of ordinary chat. The category on a reply save is personal to that saved item. | Confirmed; qualifies earlier immediate-save wording |
| 2026-09-27 | Share to one Table per action in MVP; defer multi-Table selection. | The owner explicitly chose a simpler first-version flow. A Plate may still appear in several Tables through separate sharing actions. | Confirmed |
| 2026-09-27 | Use `Reply in thread` initially and show the reply count once replies exist. | Makes the thread destination and existing discussion visible from the shared contribution in the Table. | Confirmed |
| 2026-09-27 | Use a readable compact Plate preview, keeping original author and Table sharer distinguishable. | The owner confirmed that the tiny complete feed card was only a wireframing shortcut. | Confirmed direction; detailed styling open |
| 2026-09-28 | Show the original Plate author at the top of a saved item, and the Table sharer alongside the source Table and `View Table discussion` link. | Separates authorship from how the saver encountered the Plate and provides a clear route to the particular discussion. | Confirmed direction; detailed layout open |
| 2026-09-28 | Confirm a Plate save in place with `Saved`; opening the Menu remains a separate action. | Saving should not interrupt the current Table discussion. | Confirmed |
| 2026-09-29 | Every Plate share creates a fresh discussion thread, including repeated shares into the same Table. | The owner prefers a simple new-discussion flow rather than finding and reopening an earlier thread. | Confirmed |
| 2026-09-29 | Keep a captured Menu representation while opening the original Plate loads its latest state. | The save preserves the idea as encountered, while revisiting the source shows later edits. | Confirmed; snapshot fields/media open |
| 2026-09-29 | Retain the captured Menu item when the original Plate is removed. | The owner wants a thumbnail or equivalent reminder to remain even when the live original can no longer be revisited. | Confirmed for ordinary source removal; other access-change cases open |
| 2026-09-29 | Defer private author profiles; opening a shared Plate does not require following its author. | The owner agreed to avoid profile-privacy complexity at the beginning. Table conversation remains private to members; logged-out browsing is not decided. | Confirmed MVP direction |
| 2026-09-29 | Separate live Plates, individual Table shares/thread roots, and captured Menu saves in the logical-model draft. | Supports fresh discussions on repeat shares, original-author/sharer attribution, current originals, and retained reminders. | Proposed record design supporting confirmed behaviour; owner review pending |
| 2026-09-29 | Treat individual-message saving as unresolved and omit it from the baseline draft. | The owner's latest uncertainty qualifies the September 26 conceptual approval and reply-category rules above; the reviewed wireframe saves a Plate. | Scope unresolved; earlier entries retained for history |
| 2026-10-04 | Record later agreement: one Plate save per person with multiple explicitly kept source discussions; no snapshot refresh when adding a source. | Avoid duplicate Menu items and silent source loss. | Confirmed in conversation; reconciled today |
| 2026-10-04 | Record later agreement: formal Table Requests have dedicated threads and saveable entries that reopen current answers. Feed Requests are deferred. | Recommendations should remain useful after ordinary chat moves on. | Confirmed; generated and owner wireframes reviewed |
| 2026-10-04 | Record later agreement: show current Plate content with `Edited since shared`; reserve broader saved-copy removal for account deletion/intervention. | Keep revisits current while preserving reminders, with a separate removal mechanism. | Confirmed direction; detailed removal policy open |
| 2026-10-04 | Choose mobile-friendly Next.js/TypeScript/Tailwind with Supabase and eventual Vercel hosting; begin building without more wireframing prerequisites. | Owner wants momentum, knows SQL and has assisted React/Next.js and Vercel experience. Keep initial costs low. | Confirmed stack direction; setup permissions pending |
| 2026-10-04 | Record later agreement: consider blocking/reporting in architecture, defer initial user-facing controls. | First release is a friends-only trial. | Confirmed; exact blocking semantics open |

## Testing and verification

- Latest checks (2026-10-04): Reviewed reconciled product/scope/data/journey statements against the conversation and checked local Markdown link targets against the nine-file Markdown inventory. Node/npm availability probes both failed with command-not-found. No app tests, build, database migrations or installations ran; Mermaid source was inspected, not rendered.
- Latest planning checks (2026-09-29): Reviewed the draft relationships against repeated shares, separate private discussions, direct feed saves, Table-source saves, later edits/removal, non-follower access, and text-only content. Checked local Markdown link targets against the file inventory and reconciled current journey/ledger summaries. No application tests apply; the Mermaid diagram source was reviewed but not rendered.
- Checks completed: Reviewed 245 images across 96 non-overlapping media-led sequences, plus one URL-led recommendation thread; checked the resulting research notes for aggregate-only wording and separation of findings from proposals.
- Results: Every selected image was reviewed. The visual samples share no sequences. All multi-image and link-bearing media sequences in the export have been covered; the remaining 120 image sequences each contain one image. The targeted review confirmed that both standalone images and URL-led requests can be high-value conversational contributions. No source image, direct quotation, participant name, URL, or raw message was added to the repository.
- Checks not completed: No application tests, build, lint, or type checks were applicable because no application exists yet.
- Reason they were not completed: This session was product research and documentation only.

## Owner actions and commands

- Pending: confirm the active non-main feature branch and whether the agent may install the named npm dependencies/run local verification, or the owner prefers guided commands. Questions have been sent; no answer assumed.
- Runtime: Node/npm are unavailable in the inspected shell. Check whether they work in the owner's normal terminal before proposing installation. No runtime installation is authorised or performed by this note.
- No cloud project, deployment, billing or credentials are required for the documentation work. Do not access the bundled Git executable returned by runtime discovery.

List actions that only the project owner should perform. Explain each command before presenting it, and never record a command as completed until the owner confirms it.

- Action needed:
- Where to run it:
- Command:
- Expected result:
- Status: Not run / Confirmed complete

## Known issues, risks, and assumptions

### Known issues

- The source chat export contains private, non-anonymised third-party conversation. It remains outside the repository and must not be copied, published, or committed in its current form. Privacy-reduced working indexes also remain beside the private export outside the repository.
- The automatic image indexes are not safe to publish or share as fully anonymised artefacts. Participant display names were removed, but incidental names mentioned within message bodies were not always detected. Treat both indexes as sensitive private working material.

### Risks

- Most of the larger transcript's omitted media is still unavailable; the 365-image export does not cover the complete chat history. Of this export, 245 images have been reviewed and 120 standalone images remain unreviewed.
- The combined 245-image review used purposive and structurally stratified sampling, so it establishes patterns and edge cases but not their prevalence. Standalone images must not be assumed to be less important merely because they contain fewer media items.
- Over-structuring `Table` conversation could remove the spontaneity and social value demonstrated by the founding group.
- Even close friends in the initial audience may hesitate when private conversation or social photos are involved. If privacy boundaries are not obvious before sharing, this could undermine the trust that is meant to differentiate Plates.
- Ingredient search could leak private context if search is treated as a separate permission surface. Every result must remain constrained by the viewer's existing access.

### Assumptions requiring confirmation

- Plate discussions within Tables are threads, reached from a shared contribution in the main conversation. The first wireframe establishes this placement; `Reply in thread` and subsequent reply counts are confirmed. Detailed visual treatment and usability remain to be tested.
- Plates require a publisher-selected broad category that supports Menu sorting. Whether multiple broad categories are allowed and the final category list remain open. Personal collections are deferred beyond MVP. Saving a Plate retains its category. Earlier saver-selected categorisation of ordinary replies remains historical context, conditional on resolving message-save scope.
- Objective Plate context (for example, an attached recipe or restaurant) may need to remain distinct from a saver's personal reason for keeping it (for example, ingredient inspiration or a meal idea). The exact model remains unresolved.
- The owner remains unsure about message saving as of 2026-09-29. Earlier conceptual support and category discussions are historical context, not a settled general message-save MVP requirement. Keep the message-save interaction and its eligibility separate from the established Plate-save flow.
- A Plate save now has a captured Menu representation and a reference to the live original/source discussion. The captured item survives ordinary removal of the original; reopening the original shows the latest state if available. Exact snapshot fields, retained media, and treatment of access changes remain open. This distinction must be reflected in the logical data model.
- Shared Plates can be opened independently of following, with no private author profiles in MVP. Signed-in-only versus logged-out browsing remains open; the draft proposes a signed-in first version. Table membership remains a separate access boundary.
- The third sea-bass response expresses a preference to retain recipe and photo together. It is unverified whether return-to-source navigation alone satisfies that preference. A related Plate/photo preview on a saved recipe is a candidate wireframe refinement; do not infer media associations or expand scope without an owner decision.
- “Taster Menus” is a candidate name for user-created collections within the Menu; it may be memorable or too glib and requires language testing.
- Visual evidence supports ordered multi-image Plates, optional structured context, explicit audience controls, and user-controlled splitting of photo bursts. These are research proposals rather than confirmed requirements.
- The second sample suggests optional per-image notes, author-controlled enrichment after initial sharing, and support for intentional multi-meal recaps. These refinements are not yet confirmed MVP requirements.
- The final samples support deliberate media selection when promoting Table content to a Plate, source provenance, Table-native temporary tips or offers, and keeping nutrition or food-safety claims non-authoritative. These remain research proposals rather than confirmed requirements.
- A targeted counter-bias review confirmed that requests, free text, URLs, and standalone images can each carry the primary value. Product and research work must not default to a photo-first mental model.
- Search across accessible Plates and within a user's Tables, including Plate author-name lookup, and basic Table image browsing are confirmed. Ordinary text/tag matching remains a proposal for the detailed MVP scope. Optional extra Plate tags are distinct from the required broad category. Content-based tag suggestions are provisionally deferred; ingredient search need not recognise the contents of an untagged photo.
- “Dinner Time” may be a product name, feature name, or community concept; naming has not yet been decided.

## Recommended next steps

1. Resolve branch confirmation, npm installation/verification permission, and Node/npm availability. Follow the owner's chosen guided or agent-run setup mode. Never execute Git, including from scaffolding tools.
2. Scaffold the local Next.js app, then write initial PostgreSQL migrations and permission tests for the first complete Plate-sharing/save loop. Follow `STACK.md`; do not make remaining wireframes a prerequisite.
3. Add formal Table Requests with live-discussion saves, then initial search and image browsing. Keep individual-message saving outside baseline.
4. Settle snapshot limits and destructive lifecycle policies before enabling dependent operations; review membership access through two members and a non-member, including private media.
5. Incorporate further friend feedback without blocking progress. Hosted accounts, cloud migrations, publication and spending need separate authorisation; no unattended automation is requested.

## Workflow improvements

Record lessons and possible improvements to the way the project is developed, tested, documented, or handed over.

- When a material product decision is proposed or confirmed, compare it with the current decisions and assumptions before recording it. Explicitly flag genuine conflicts, distinguish refinements from contradictions, and mark superseded ideas rather than silently rewriting the history.
- Use the initial discovery framework as a baseline for periodically reviewing how and why the product model changed, not as a rigid sequence that prevents useful branches. After a productive branch, return explicitly to the unfinished core journeys.

## Session history

Add a concise dated entry after each material working session. Preserve earlier entries unless the owner explicitly approves their deletion.

### YYYY-MM-DD — Session title

- Objective:
- Work completed:
- Files changed:
- Verification performed:
- Decisions made:
- Outstanding items:
- Suggested starting point for the next session:

### 2026-09-22 — Initial product scoping

- Objective: Begin scoping a purpose-built social application for sharing food experiences, recipes, reviews, and recommendations.
- Work completed: Read the project working rules and ledger; inspected the currently minimal local folder; proposed an initial product framing and MVP boundary; recorded the canonical GitHub repository supplied by the owner.
- Files changed: `HANDOVER.md` only.
- Verification performed: Confirmed the local folder currently contains `AGENTS.md` and `HANDOVER.md`; no Git commands were run and the remote repository was not accessed.
- Decisions made: None confirmed yet. A trusted friend-led food network and a flexible core post object were proposed for discussion.
- Outstanding items: Confirm the first target audience, core user problem, initial user journey, and MVP feature boundary.
- Suggested starting point for the next session: Identify the first narrow user group and the behaviour that should make Plates worth returning to regularly.

### 2026-09-22 — Founding audience and product model confirmed

- Objective: Clarify the initial audience and validate the proposed product framing.
- Work completed: Identified an existing friend group chat, “Dinner time,” as the founding use case and recorded the owner's confirmation of the trusted-network positioning and flexible `Plate` content model.
- Files changed: `HANDOVER.md` only.
- Verification performed: Product decisions were confirmed directly by the owner; no application checks were applicable.
- Decisions made: Prioritise trusted friend content; use a flexible `Plate` object; focus initially on close friend groups already sharing food content in chats.
- Outstanding items: Decide whether private groups are part of the MVP and define the detailed posting and consumption journeys.
- Suggested starting point for the next session: Catalogue the recurring interactions in “Dinner time” and decide which must be preserved in the first release.

### 2026-09-22 — Private conversation added to MVP

- Objective: Confirm whether conversational groups are part of the initial product.
- Work completed: Confirmed private, Discord-style conversations as an MVP capability and outlined a local, privacy-conscious approach for analysing the founding group chat.
- Files changed: `HANDOVER.md` only.
- Verification performed: Decision confirmed directly by the owner; no application checks were applicable.
- Decisions made: The MVP must retain spontaneous private group conversation alongside the structured food feed.
- Outstanding items: Export and analyse representative “Dinner time” interactions; define how conversation content becomes or references a `Plate`.
- Suggested starting point for the next session: Obtain a privacy-safe chat export and develop a behavioural taxonomy from real interactions.

### 2026-09-22 — Founding chat initial analysis

- Objective: Assess the non-anonymised, text-only “Dinner time” export and determine whether missing media prevents useful product research.
- Work completed: Parsed aggregate chat structure locally; assessed media context; reviewed anonymised representative conversation sequences; documented recurring behaviours, a multidimensional taxonomy, product implications, and research limitations.
- Files changed: Added `CHAT_RESEARCH.md`; updated `HANDOVER.md`. The source export was not modified or copied.
- Verification performed: Parsed 6,051 messages from 24 participants covering 19 May 2025 through 22 September 2026; reconciled 1,232 media-bearing messages with surrounding context.
- Decisions made: None newly confirmed by the owner. Proposed that Tables retain ordinary chat, that Plates can be shared into or emerge from conversation, and that recommendation requests receive first-class product treatment.
- Outstanding items: Owner review of the initial findings; representative cluster review; selective visual sampling; detailed Table and Plate user journeys.
- Suggested starting point for the next session: Review the relationship proposed between ordinary Table messages, Plates, requests, and durable searchable content.

### 2026-09-23 — Media export structure verified

- Objective: Confirm that the larger image export can be cross-referenced with its transcript before beginning visual analysis.
- Work completed: Inventoried the export without opening image contents and verified exact filename references for 365 JPEG attachments.
- Files changed: `HANDOVER.md` only. Source research files remained outside the repository and were not modified.
- Verification performed: The export contains one transcript and 365 JPEGs, plus ordinary Finder metadata. All 365 JPEG filenames occur in the accompanying transcript.
- Decisions made: None. Visual review will proceed incrementally.
- Outstanding items: Build a privacy-safe message-to-image index; inspect a small representative batch.
- Suggested starting point for the next session: Create the attachment/context index without opening or classifying the images.

### 2026-09-23 — Anonymised image/context index created

- Objective: Link exported images to surrounding chat while minimising exposure of participant information.
- Work completed: Created a revised private CSV index beside the source export covering 365 images across 216 posting sequences. Used stable participant IDs and redacted participant names, email addresses, phone numbers, mentions, and UK postcodes. Preserved useful URL domains and paths while removing query parameters and fragments.
- Files changed: `HANDOVER.md` in the repository; `anonymised-image-index.csv` and `anonymised-image-index-v2.csv` beside the private export outside the repository. Raw source files were not modified.
- Verification performed: All 365 JPEGs are indexed; no source JPEGs are missing or unindexed. Validation found no full participant names, emails, phone patterns, postcodes, or URL query/fragment data in the revised text fields.
- Decisions made: Preserve privacy-reduced URLs because recipe and venue links are product-relevant research data.
- Outstanding items: Select a small representative set from the anonymised metadata, then inspect image contents incrementally.
- Suggested starting point for the next session: Rank 15–20 candidate posting sequences without opening images.

### 2026-09-23 — Representative image sequences shortlisted

- Objective: Select a small, varied visual-research set using anonymised metadata before opening any images.
- Work completed: Created a metadata-only shortlist of 18 posting sequences covering recommendation requests, recipes and cooking, venues, ingredients and products, travel food, social reactions, linked content, multi-image posts, high-engagement posts, and sparse-context posts.
- Files changed: `HANDOVER.md` in the repository; `selected-sequences-v1.csv` beside the private export outside the repository.
- Verification performed: The shortlist covers 63 images, 13 anonymous senders, and five months represented in the media export. No image contents were opened.
- Decisions made: Review selected sequences incrementally rather than loading the entire export or shortlist at once.
- Outstanding items: Choose the first small visual-review batch and inspect it alongside anonymised context.
- Suggested starting point for the next session: Review approximately five shortlisted sequences, prioritising varied behaviour and a manageable image count.

### 2026-09-23 — Visual sample review

- Objective: Determine what the representative images add to the text-only product research while protecting participant privacy.
- Work completed: Reviewed all 63 images across 18 selected sequences and added only aggregate, anonymised findings to `CHAT_RESEARCH.md`.
- Files changed: `CHAT_RESEARCH.md`, `HANDOVER.md`. No source images or messages were copied into the repository.
- Verification performed: Checked every image in the agreed shortlist alongside its pseudonymised sequence context. Confirmed that one food experience can combine several dishes, venue, preparation, people, and occasion, while one photo burst can also contain several distinct potential Plates.
- Decisions made: None newly confirmed by the owner. Research proposals now include an explicit Table-message/Plate distinction, ordered multi-image Plates, reversible grouping, optional structured enrichments, and explicit audience controls.
- Privacy correction: Automatic participant-name redaction did not reliably remove incidental names within message bodies. The private indexes must remain sensitive working material and should not be shared as fully anonymised outputs.
- Outstanding items: Owner review of the proposed content boundaries; MVP user journeys; audience model; minimum Plate fields.
- Suggested starting point for the next session: Decide whether a Plate must always be deliberately published or whether its author can promote an existing Table message later.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-24 — Second visual sample review

- Objective: Test the first visual findings against a similarly sized, non-overlapping sample and identify further edge cases without exposing participant data.
- Work completed: Reviewed 61 new images across 18 sequences, selected across single images, small and medium groups, long bursts, and link-bearing sequences. Added only aggregate findings to `CHAT_RESEARCH.md`.
- Files changed: `CHAT_RESEARCH.md`, `HANDOVER.md`. A temporary metadata-only shortlist was used outside the repository; no source image or message was copied into the project.
- Verification performed: Confirmed that none of the second sample's sequences appeared in the first sample. All 61 selected images were reviewed alongside private pseudonymised context.
- Findings: The first model was broadly validated. New refinements include optional per-image notes, editable or promoted Plates that can incorporate later context, intentional travel or occasion recaps spanning several moments, and explicit rather than proximity-based attachment of links.
- Privacy finding: Menus, receipts, labels, screenshots, group photos, and images involving children reinforce the need for explicit audience selection and review before any extracted information is published.
- Decisions made: None newly confirmed by the owner. The refinements remain product proposals.
- Outstanding items: Confirm the Table-message/Plate promotion model, decide whether per-image notes belong in the MVP, and define how broad recaps relate to venue-specific Plates.
- Suggested starting point for the next session: Map one real sequence into a Table-to-Plate user journey and test the proposed boundaries without copying the source content.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-24 — Final visual sample reviews

- Objective: Complete two final manageable visual batches, extend the research beyond the earlier samples, and leave the project ready for journey definition.
- Work completed: Reviewed 120 additional images across 59 non-overlapping sequences in two 60-image batches. The selection included every previously unreviewed multi-image and link-bearing sequence, then a varied set of standalone images. Added only aggregate, anonymised conclusions to `CHAT_RESEARCH.md`.
- Files changed: `CHAT_RESEARCH.md`, `HANDOVER.md`. Source images, messages, names, and the private working indexes remained outside the repository.
- Verification performed: All 120 selected images were opened and reviewed alongside private pseudonymised context. Across all four batches, 244 of 365 images and 95 of 216 sequences have now been reviewed. The remaining 121 sequences each contain one image.
- Findings: Tables need to accommodate temporary local tips, deals, offers, products, sources, tangents, and accidental shares. Promoting Table material to a Plate should use an explicit media-and-context picker with audience review. Text and replies often carry meaning the image cannot, source provenance must be explicit, and third-party nutrition or food-safety claims must not be treated as authoritative structured facts.
- Decisions made: None newly confirmed by the owner. The findings remain product proposals until the Table, Plate, and Request journeys are agreed.
- Outstanding items: Confirm the promotion and audience model; map the core journeys; define the MVP boundary and initial screen map.
- Suggested starting point for the next session: Draft the Table-to-Plate journey, including deliberate media selection, later enrichment, source attachment, and privacy review.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-24 — Single-image and URL counter-bias review

- Objective: Test whether the research had over-weighted multi-image food stories and under-weighted standalone images, URLs, and request-led conversation.
- Work completed: Reviewed one previously unreviewed standalone-image sequence and one separate URL-led restaurant-recommendation thread. Updated the research model to treat text, links, and images as equally primary sharing formats.
- Files changed: `CHAT_RESEARCH.md`, `HANDOVER.md`. The private source image, message text, participant details, and URLs remained outside the repository.
- Verification performed: Inspected the standalone image and its full conversational context; inspected the recommendation request, its answers, qualifications, and map-link responses. Rechecked the documentation for aggregate-only wording.
- Findings: A single image can primarily be a conversational prompt rather than a display post. A text request can generate useful recommendations through names, explanations, trade-offs, and URLs without any imagery. The valuable object is often the request-and-answer cluster, and a saved URL should retain the trusted person's explanation and conversational provenance.
- Decisions made: Confirmed by the owner that recipes, restaurant recommendations, URLs, requests, text, and images are equally important; Plates must not become a purely food-image platform.
- Outstanding items: Ensure the future Table, Plate, Request, feed, save, and search journeys are format-neutral and preserve link context.
- Suggested starting point for the next session: Model three parallel journeys—share a meal, share a recipe URL, and ask for recommendations—then identify their common primitives.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-25 — Prospective-user privacy and ingredient-search insight

- Objective: Record new product feedback from an informal conversation with two people resembling the initial target audience.
- Work completed: Documented initial privacy concern, subsequent enthusiasm after the research handling was explained, a confirmed comparison with Goodreads, and a spontaneously proposed ingredient-led search capability. Distinguished observations from interpretation and product proposals.
- Files changed: Added `PRODUCT_DISCOVERY.md`; updated `HANDOVER.md`.
- Verification performed: The owner confirmed that Goodreads was the referenced book platform. Checked its public description to understand the friend-led discovery model and reviewed the new notes to ensure no participant identities, quotations, or private conversation content were recorded.
- Findings: Privacy must be a visible part of the product proposition. Ingredient discovery expresses a concrete job—finding how trusted people have used what someone already has—and should span accessible Plates, recipe links, and reusable answers rather than being reduced to a mandatory tag taxonomy.
- Decisions made: None newly confirmed as an MVP requirement. Ingredient-led search is a promising proposal; privacy boundaries require definition before detailed interface work.
- Outstanding items: Define the privacy promise and search permission boundaries; test the ingredient-search job and decide whether optional ingredient labels belong in the MVP.
- Suggested starting point for the next session: Compare the core journeys for sharing a meal, sharing a recipe URL, asking for recommendations, and searching by ingredient.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-25 — Plate, Table, and Menu relationship mapping

- Objective: Begin mapping how deliberate feed contributions and ordinary group conversation relate without prematurely designing the interface.
- Work completed: Used concrete sharing scenarios to distinguish casual Table contributions from deliberately published Plates; clarified that Plates can be brought into multiple Tables as references while Tables remain independent conversation spaces; defined the personal `Menu` concept for immediately saving Plates into automatic categories with optional personal collections.
- Files changed: `HANDOVER.md` only.
- Verification performed: Compared the emerging model with the owner's observed food-sharing behaviour and, as a limited interaction reference, Substack's current separation of published content, feed activity, and messaging. No application checks were applicable.
- Decisions made: A Plate is defined by deliberate publishing action, not by format or completeness. Plates and Tables have a many-to-many relationship. Saving to the Menu is immediate; automatic Plate categories provide default organisation, while user-created collections remain optional.
- Outstanding items: Test chronological chat versus attached or hybrid Plate discussion; determine Plate classification signals, multi-category behaviour, correction, Menu retrieval, and collection language; continue mapping Requests.
- Suggested starting point for the next session: Map deliberate Plate creation and identify which information comes from the author versus being recognised by the product.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-25 — Categorisation perspective clarified

- Objective: Check the evolving product model for contradictions and clarify who benefits from Plate categorisation.
- Work completed: Compared the current discussion with all recorded decisions and research proposals. Distinguished objective Plate context from the different personal reasons recipients may save the same Plate.
- Files changed: `HANDOVER.md` only.
- Verification performed: Reviewed `HANDOVER.md`, `PRODUCT_DISCOVERY.md`, and `CHAT_RESEARCH.md` for conflicts involving Plates, Tables, feeds, saving, categories, tags, Requests, and search.
- Decisions made: A publisher should not be forced to choose one category. Plates may support several simultaneous receiver-centred uses, while saving remains immediate and personal collections remain optional.
- Superseded idea: The tentative suggestion that selecting a category might be the principal friction in publishing no longer reflects the current direction.
- Genuine unresolved tension: A sparse Plate cannot be accurately organised by the saver's intended use with no input from either party and no inference mechanism. This is a design question, not a contradiction in the proposition.
- Other open questions, not contradictions: Plate discussion placement inside Tables; how Requests behave; whether non-Plate Table material can be saved; automatic classification scope; detailed Menu retrieval; and activity-feed behaviour.
- Suggested starting point for the next session: Explore the difference between facts attached to a Plate and the private intent attached to a save.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-25 — Categorisation decision reopened through the sea-bass journey

- Objective: Ground the categorisation model in the complete social sequence rather than one isolated saving action.
- Work completed: Mapped an alternative journey in which a sea-bass Plate is published as a meal, brought to a Table, discussed, and followed by a recipe or answer that may be more useful to save than the original Plate.
- Files changed: `HANDOVER.md` only.
- Clarification: The immediately preceding conclusion that categorisation primarily belongs to the receiver was not sufficiently tested and is now reopened. This entry preserves rather than erases that evolution.
- Insight: Plate categorisation and Menu save targets are separate questions. The Menu may need to retain a Plate, a useful conversational follow-up, or an enriched Plate while preserving their relationship and source context.
- Outstanding item: Test the three variants with prospective users before making publisher category or Menu contents an MVP requirement.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-25 — Product-model session wrap-up

- Objective: Assess overall progress and leave a clear continuation point before pausing for prospective-user feedback.
- Work completed: Consolidated the current Plate, Table, and Menu model; separated settled decisions from open interaction questions; prepared a neutral WhatsApp-based current-behaviour prompt about saving a meal photo and any recipe or explanation that follows.
- Files changed: `HANDOVER.md` only.
- Current position: Discovery evidence is sufficient; no further archive review is planned. The work has not yet moved into screens or implementation because the central save target and categorisation mechanics are still being tested.
- Next input: Prospective users' unprompted answers about what they would keep, how they would retrieve it, and whether source conversation matters.
- Next output after feedback: Resolve or narrow the save model, complete the remaining core journeys, then produce the MVP boundary and initial screen map.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-25 — First complete core-journey map

- Objective: Complete the remaining user journeys before ending the session while leaving prospective-user save feedback open until it arrives.
- Work completed: Mapped Table-to-Plate promotion, broadcast and Table-native Requests, optional Request outcomes, Menu retrieval, and the direction for app-wide search; consolidated these with the previously explored casual sharing and Bring-to-Table journeys.
- Files changed: Added `USER_JOURNEYS.md`; updated `HANDOVER.md`.
- Decisions made: Promotion creates an editable Plate draft from an author's own Table material. Requests may live in a Table or be deliberately broadcast in the feed; replies remain where posted and no resolution is mandatory. Broad accessible-content search is the longer-term direction, while exhaustive tagging, image classification, and semantic search are not MVP prerequisites.
- Verification performed: Ran a cross-journey consistency review covering deliberate publishing, contextual conversation, format-neutral sharing, optional enrichment, Menu utility, and low-friction participation. No foundational contradictions were found.
- Outstanding items: Sea-bass save target and categorisation feedback; Plate presentation within Tables; exact first-version search scope; optional Plate enrichments; MVP boundary.
- Suggested starting point for the next session: Compare prospective-user save behaviour with the three current save models, then freeze Product Model v1.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-26 — First sea-bass responses reviewed

- Objective: Review the first two prospective-user responses before narrowing the Menu save model.
- Work completed: Read the project rules, handover, journeys, discovery notes, and relevant research passages. Added anonymised summaries of the responses, distinguishing existing behaviour, hypothetical preference, interpretation, and proposals.
- Files changed: `PRODUCT_DISCOVERY.md`, `HANDOVER.md`.
- Findings: One respondent copies recipe text into personal notes and otherwise relies on keyword search or asking again. The other uses keyword search and visual browsing to recover recipes and recommendations, and browses images for inspiration. Neither habit requires a prior save; the second response does not specify a save target. Source person/group can help recognition, but preserving a whole conversation was not established as necessary.
- Evidence limits: Two informal self-reports cannot establish prevalence or distinct user segments. Later scenario questions supplied possible save targets and prompted source attribution, so the feedback is not wholly unprompted.
- Decisions made: None newly confirmed. Proposed retaining useful recipe/answer content with source context, testing saves that do not depend on author enrichment, and considering Table keyword search and image browsing when setting initial retrieval scope.
- Verification performed: Checked the summaries against the supplied responses and existing journey model; no application tests apply to this documentation-only work.
- Outstanding items: Owner discussion of the proposed save requirement; exact save object; Plate presentation in Tables; first-version search scope; Product Model v1 and MVP boundary.
- Suggested starting point for the next session: Test what happens when a useful recipe remains only a Table reply and its author never enriches the original Plate.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-26 — Direct saving of Table replies confirmed

- Objective: Resolve whether useful Table material can enter the Menu without becoming a Plate.
- Decision: The owner explicitly confirmed that someone can save a useful recipe directly from a Table reply even if it remains only a reply forever. The Menu therefore supports useful Table contributions alongside Plates; author promotion or enrichment is not required.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`. Earlier session entries and discovery reasoning were preserved.
- Verification performed: Reviewed the documentation changes for consistency with the owner's confirmation and the existing deliberate-publishing boundary. No application tests were applicable.
- Outstanding items: Saved-item presentation and source behaviour; categorisation; Plate presentation inside Tables; initial search scope; Product Model v1 and MVP boundary.
- Suggested starting point for the next session: Define a saved recipe reply's Menu presentation and source connection, then resolve Plate discussion presentation within Tables.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-26 — Return to original shared content confirmed

- Objective: Clarify how a saved Table contribution retains its source context.
- Decision: The owner agreed that saved replies show useful content and who shared it, with an easy link or action back to the original contribution in its conversation. Slack is an interaction reference only.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`. Earlier session entries were preserved.
- Verification performed: Reviewed the documentation changes against the owner's confirmation and the existing audience boundaries. No application tests were applicable.
- Outstanding items: Detailed Menu presentation and behaviour after source edits or access changes; categorisation; Plate presentation within Tables; initial search scope; Product Model v1 and MVP boundary.
- Suggested starting point for the next session: Resolve or test how a Plate and its discussion appear within a Table, with saved replies able to return to their original location.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-26 — Further discovery made non-blocking

- Objective: Establish the current position and keep product definition moving while more friend responses arrive.
- Decision: The owner explicitly confirmed that additional sea-bass feedback must not block progress. Proceed with the existing evidence, make provisional choices explicit, and use later feedback to refine or challenge them.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`. Earlier session entries were preserved.
- Verification performed: Reviewed the updated next steps for consistency across the three documents. No application tests were applicable.
- Current position: All six core journeys are mapped. Direct Menu saves of useful Table contributions and navigation back to the original contribution are confirmed. Product Model v1, the MVP boundary, screens, and application implementation have not yet been produced.
- Next steps: Choose a working Table discussion model; set initial search and browsing scope; establish lightweight Menu organisation while consolidating Product Model v1 and the MVP boundary; map the screens. Further research proceeds alongside these steps.
- No Git commands, dependency changes, deletions, publishing, deployment, or remote-service actions were performed.

### 2026-09-26 — Threads and accessible-content search confirmed

- Objective: Capture the owner's thread, search, and publishing choices and move discussion to the MVP boundary and screen-mapping process.
- Decisions: Plate discussions within Tables act as threads. Users can search accessible Plates and within their Tables; Table content stays private to members. Plate author-name search supports rediscovery without tags. Publishing requires no extra tags or information, but optional tags should help discovery. Content-based tag suggestions are desirable but provisionally outside MVP.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`. Earlier session entries were preserved.
- Verification performed: Reviewed changes for consistency with the owner's message and the existing privacy and deliberate-publishing boundaries. No application tests were applicable. Public official design-tool pages were checked using generic queries; no project content was sent.
- Outstanding items: Discuss Menu organisation and the MVP boundary; decide Table image browsing; consolidate Product Model v1; choose a screen-mapping workflow. A combined search across Tables and precise thread-entry placement remain unconfirmed.
- No Git commands, dependency changes, deletions, publishing, deployment, or access to external project accounts occurred.

### 2026-09-26 — Broad categories and Table media view clarified

- Objective: Correct the interpretation of low-friction Plate publishing and record the agreed first-version organisation and browsing scope.
- Decisions: A broad category is required when publishing a Plate; extra tags are optional. Broad categories support Menu sorting. Extra personal subcategories and collections are deferred beyond MVP. Basic Table image browsing is included, with WhatsApp's chat media view as the reference.
- Historical clarification: Earlier no-required-category wording is superseded by this explicit owner clarification. Previous session entries are preserved. The final category list and whether multiple broad categories are allowed were not decided.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`.
- Verification performed: Checked the earlier categorisation discussion and reviewed the updated journey and current-state wording against the owner's clarification. No application tests were applicable.
- Open question: A saved Plate is understood to retain its existing category; the owner has been asked whether the saver chooses a category when saving an ordinary Table reply with no Plate category. Do not silently assume the answer or require ordinary Table messages to become Plates.
- Design workflow: The owner has used Excalidraw and Figma and is less confident with Figma. No tool choice or external project action was authorised.
- Next steps: Resolve the Table-reply save category, consolidate Product Model v1 and the MVP boundary, then create the screen map.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-26 — Table-reply save category confirmed

- Decision: The owner confirmed that saving a Plate retains its existing category, while saving an uncategorised Table reply requires the saver to choose a broad category. The reply remains ordinary Table content; the chosen category organises the personal save.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`.
- Verification performed: Reviewed the updated current-state and journey wording for consistency with the confirmation. Earlier pending questions remain in historical notes with this dated resolution. No application tests were applicable.
- Clarification: The earlier immediate-save principle now has a limited exception for Table contributions without a category. Additional personal subcategorisation is not required and remains outside MVP.
- Next steps: Consolidate Product Model v1 and the MVP boundary, then create the screen map. The broad-category list can be provisional and refined during design.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-27 — First sharing wireframe reviewed

- Work completed: Reviewed the owner's supplied feed → Table selector → share composer → main Table conversation → Plate thread wireframe and captured the owner's follow-up decisions.
- Decisions: One Table per share action in MVP, with no multi-Table selection. Use `Reply in thread` initially and show the reply count after replies exist. Use a compact readable Plate preview with original authorship; the miniature feed card was a drawing shortcut.
- Files changed: `USER_JOURNEYS.md`, `HANDOVER.md`. No source wireframe was edited or copied into the project.
- Verification performed: Visually reviewed the supplied image and checked the documented choices against the owner's confirmation and existing many-to-many Plate/Table model. This was a design review, not a usability test; no application checks were applicable.
- Next steps: Extend the flow through saving a useful Table reply, choosing its category, finding it in the Menu, and returning to the original reply. Consolidate Product Model v1 and the formal MVP boundary alongside the wireframes.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-28 — Third sea-bass response reviewed

- Work completed: Added an anonymised summary of the third response and compared it with the first two responses and the current save/retrieval model.
- Findings: Existing keyword-search reliance, an ideal preference for keeping recipe and photo together, uncertainty about photo-only usefulness, and value in the personal source connection. The respondent's speculation about image search was not treated as a verified product capability or observed behaviour.
- Files changed: `PRODUCT_DISCOVERY.md`, `HANDOVER.md`. No raw response or identifying details were copied into the project.
- Decisions: No new product decisions. Proposed testing a small related Plate/photo reference alongside a saved recipe reply where an explicit source relationship exists. Direct reply saves, category rules, and deferred image recognition remain unchanged.
- Verification performed: Checked the summary against the supplied response and existing documentation, distinguishing current behaviour, stated preference, speculation, and design proposals. No application tests were applicable.
- Next steps: Continue the save-to-Menu wireframe; use the recipe-and-photo preference to evaluate saved-item presentation without blocking progress or assuming a new composite save feature.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-28 — Thread creation and message saving distinguished

- Owner clarification: The supplied wireframe shows discussion under a shared Plate. It does not propose arbitrary message-created threads that can then be saved. The owner has not yet considered how saving a single message would look.
- Assistant clarification: The intended example saves one recipe reply within the existing Plate thread; that action creates no new thread. Earlier conceptual support for retaining useful replies was presented too readily as a settled general message-saving interaction.
- Files changed: `USER_JOURNEYS.md`, `PRODUCT_DISCOVERY.md`, `HANDOVER.md`. Prior decisions and session entries were preserved with this qualification.
- Verification performed: Checked the clarification against the owner's message, the reviewed wireframe, and the earlier save discussion. No implementation or application tests were involved.
- Next steps: Discuss saving a single message and its Menu presentation as a separate interaction from saving the Plate. Do not infer arbitrary message threads, nested threads, whole-thread saves, or approval of the related-photo preview.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-28 — Plate-save and return-to-discussion wireframe reviewed

- Work completed: Reviewed five supplied close-ups covering feed, Table selection, sharing, main conversation, Plate thread, and Menu. The new Menu view retains the saved Plate's visual/content summary and a link back to its source Table discussion.
- Scope clarification: The depicted save is of the shared Plate. It neither saves an individual reply nor creates or saves a whole thread. Earlier message-save and photo-preview proposals must not be read into this flow.
- Review points: Keep original author and Table sharer distinguishable; make the source link's thread destination clear. The arrow to Menu does not establish whether saving automatically navigates there. Suggested behaviour is to confirm the save in place and allow later Menu navigation; this is not yet an owner decision.
- Files changed: `USER_JOURNEYS.md`, `HANDOVER.md`. Source images were not edited or copied into the project.
- Verification performed: Visual review of the supplied close-ups and comparison with the current journey notes. No usability or application tests were performed.
- Next steps: Clarify post-save navigation and refine Menu attribution/source labels. Keep the separate message-save design open without changing the scope of this Plate-save flow.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-28 — Plate-save attribution and confirmation agreed

- Decisions: The owner agreed to show original authorship at the top of the saved Plate, with the Table sharer included in its source context; an explicit `View Table discussion` link returns to that particular discussion. Saving stays in the thread and changes the control to `Saved`, without automatically opening the Menu.
- Files changed: `USER_JOURNEYS.md`, `HANDOVER.md`. Earlier review notes were preserved; the navigation and attribution questions in the preceding entry are now resolved at the interaction level.
- Verification performed: Reviewed the documentation changes against the owner's three confirmations. No application or usability tests were applicable.
- Remaining work: Detailed layout, broader screen map, Product Model v1 and formal MVP boundary. Individual-message saving remains separate from this agreed Plate-save interaction.
- No Git commands, dependency changes, deletions, publishing, deployment, or external-service actions occurred.

### 2026-09-28 — Planning and execution stopping point

- Objective: Summarise progress and leave a clear continuation point as the owner ends the session.
- Confirmed state: Research and the six conceptual journeys are documented. A complete Plate-sharing, threaded-discussion, saving, and return-to-source wireframe flow has been reviewed, with attribution and in-place save refinements agreed. No usability test or implementation has occurred.
- Verification: Checked the current ledger and project file inventory. The project contains the five Markdown working documents; no standalone Product Model v1, formal MVP boundary, complete screen map, prototype, or application files were present in the listed project files. Application tests were not applicable.
- Files changed: `HANDOVER.md` only. Updated the current status and ordered next steps; preserved prior session entries.
- Resume with: Consolidate Product Model v1 and the MVP inclusion/defer list, keeping individual-message saving explicitly separate from the reviewed Plate-save flow. Then map remaining screens and journeys before prototyping and implementation planning.
- No Git commands, dependency changes, deletions, publishing, deployment, external-service actions, automations, or overnight work were initiated.

### 2026-09-29 — Data modelling, repeated shares, and captured saves

- Objective: Bring data modelling into current planning and clarify access, repeated sharing, edits, removal, and message saving in plain language.
- Decisions: Each share creates a new thread, even for the same Plate and Table. The Menu retains a captured representation; opening the original loads its current state. If the original is removed, the captured saved item remains. Exact snapshot fields and media handling are not yet specified.
- Open choices: Full Plate versus preview-only access for non-followers; whether private author accounts belong in MVP; how access changes affect source navigation; message-save inclusion. The owner explicitly remains unsure about message saving, so do not treat earlier broad wording as an approved schema requirement.
- Communication convention: Reserve `Tables` for app groups; use `records` or explicit database entity names for storage concepts.
- Files changed: `USER_JOURNEYS.md`, `HANDOVER.md`. No database, code, migration, dependency, or technology selection was created.
- Verification: Compared the updates with the owner's clarification and current journeys. Consulted official Meta material on distributed storage/private Instagram accounts and WhatsApp forwarding using generic public queries; no project content was sent. No application tests were applicable.
- Next step: Draft a logical model that separates the live Plate, each Table share/discussion, and the personal saved snapshot, while leaving unsettled access and message-save choices explicit.
- No Git commands, deletions, installations, publishing, deployment, or access to external project accounts occurred.

### 2026-09-29 — Product, MVP and logical data-model drafts

- Decision: The owner agreed to defer private author profiles. Shared Plates can be opened without following; Table discussions remain private. Logged-out browsing is not decided.
- Work completed: Created `PRODUCT_MODEL.md`, `MVP_SCOPE.md`, and `DATA_MODEL.md` as review drafts. Proposed separate live Plate, share/thread-root, and Menu-snapshot records; documented media retention, source attribution and membership boundaries. Kept message saving unresolved and outside the baseline. Snapshot fields, duplicate saves, feed rules, Request/promotion scope and membership details are explicitly open or proposed.
- Files changed: The three new drafts, `USER_JOURNEYS.md`, and this ledger. Updated current summaries and next steps while preserving previous session history.
- Verification: Reviewed relationship scenarios against confirmed behaviour; inspected decision labels and Markdown links against existing files. No application tests were applicable. The Mermaid source was reviewed but not rendered. No physical database schema, stack selection, or application code was produced.
- Next step: Review the logical model, beginning with saved fields and duplicate-save behaviour; map remaining screens and reconcile them with the proposed records. Further research responses remain non-blocking.
- No Git commands, deletions, dependency changes, publishing, deployment, or external-service actions occurred. No owner commands are pending for this documentation work.

### 2026-10-04 — Stack agreed and local setup prepared

- Objective: Move into implementation without waiting for more wireframes. Owner chose mobile-friendly web, low initial cost, and approved continuing with the Next.js/TypeScript/Tailwind/Supabase/Vercel direction.
- Work completed: Created `STACK.md`; reconciled later agreements in `PRODUCT_MODEL.md`, `MVP_SCOPE.md`, `DATA_MODEL.md`, `USER_JOURNEYS.md` and this ledger. Recorded live Request-thread saves, one Plate reminder with multiple source references, edit markers, broader removal, and deferred blocking/reporting controls. Revised the proposed logical structure to common timeline entries, eligible thread roots, replies and typed save/source relationships.
- Verification: Inspected local rules and nine Markdown files' inventory, checked updated decision labels and local link targets, and reviewed the revised relationship diagram source. No application tests were applicable. `node --version` and `npm --version` returned command-not-found; no runtime installation was attempted.
- Pending: Owner confirmation of active non-main branch, approval for named local npm dependencies and verification commands (or guided owner-run setup), and resolution of Node/npm availability. Requests were sent asynchronously; no answer was assumed. The app's bundled runtime was located read-only but not used to install or scaffold the project.
- No app files, SQL migration, Git operation, dependency installation, deletion, cloud project, deployment or paid service was created. No project content was uploaded.
- Resume with: Resolve the setup questions and runtime, scaffold without invoking Git, then implement/test the first Plate-sharing/save loop. Further wireframing is not a prerequisite.
