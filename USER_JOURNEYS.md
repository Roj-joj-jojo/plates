# Plates — Core User Journeys

Last updated: 2026-10-06

## Status

Current clarification (2026-10-06, recording October 5 decisions): use exactly one Meal (what you ate), Recipe (how to make it) or Place (where to go) category, with optional tags. An author's later Recipe can be a second Plate preserving their original Meal; shortcut details remain open. Menu reminders freeze body/links/tags/category/author name and one per-save preview, even after a rename; a first-save revision race prompts refresh. Signed-in use only: active members see full earlier Table history, owner-only invitations explain that access, and former members retain reminders without resolved source context. Members may leave but the last owner must transfer first; unpublishing preserves existing replies and reminders. Erasure instead blanks affected originals and retained copies to stubs; the full operation must be ready before real-user invitations. D1–D9 in [DATA_MODEL.md](DATA_MODEL.md) supersede the open snapshot/category/access wording in dated history below. Realtime is deferred; local Supabase CLI/Docker setup is next.

Current clarification (2026-10-04): Plate and Request wireframes have been reviewed. A formal Request goes to one Table, has its own thread, and can be saved by members; the saved entry opens the ongoing discussion with later answers under current membership rules. Feed Requests are deferred. Plate saves remain captured reminders: one per saver/Plate with multiple explicitly added source discussions, without snapshot refresh. Individual-message saving remains unresolved. The owner has chosen a mobile-friendly Next.js/Supabase stack and asked to start building without further wireframing prerequisites; see [STACK.md](STACK.md). Dated paragraphs below preserve earlier reasoning and are qualified by this update.

This document consolidates the first complete pass through the core user journeys and preserves their evolution. Plates require a broad publisher-selected category; extra tags are optional. Saved Plates retain that category and a captured representation, with links to the live original and source discussion. Individual-message saving remains unresolved following the latest clarification. Personal collections are deferred beyond MVP, and Table image browsing is included. Current review drafts: [Product Model v1](PRODUCT_MODEL.md), [MVP boundary](MVP_SCOPE.md), and [logical data model](DATA_MODEL.md).

On 2026-09-26, the owner confirmed that further prospective-user responses must not block progress. The current evidence is sufficient to make provisional design choices and proceed to Product Model v1, MVP scoping, and screen mapping. Later feedback should refine or, where warranted, challenge those choices. Detailed interface and edge-case questions need not all be resolved before the model is documented.

Clarification on 2026-09-28: the reviewed wireframe establishes discussion threads under shared Plates. It does not establish thread creation from arbitrary Table messages, nested threads, or saving whole threads. Earlier agreement about retaining a useful recipe reply must not be treated as a fully designed general message-saving interaction. The owner has not yet considered how a single saved message would look; clarify that interaction separately before extending the wireframe or adding a related-photo preview.

Current qualification (2026-09-29): the owner remains unsure about individual-message saving. Earlier conceptual discussion is preserved below, but message-save scope and MVP inclusion are unresolved; do not assume it is an approved implementation requirement. Plate saves and their captured Menu representation are the established case.

## Current product model

- A `Plate` is something its author deliberately publishes and is happy to share in the feed. It may be led by text, a URL, one or more images, or a combination.
- A `Table` is an independent persistent conversation among a group. It supports ordinary messages, questions, photos, URLs, reactions, and references to Plates.
- A `Request` deliberately asks for an idea or recommendation. Initially it is posted to one Table, with its own thread; feed broadcast is a later extension. It is not a Plate.
- The feed is an attention surface for deliberate Plates, with broadcast Requests deferred.
- The `Menu` is the personal utility layer for retaining useful food inspiration and returning to it later.

## Journey 1 — Share casually in a Table

1. A person opens an existing Table.
2. They send text, photos, URLs, or a combination with no requirement to create structured content.
3. Other members react, reply, ask questions, or add relevant material.
4. The contribution remains ordinary Table conversation unless its author deliberately promotes their material to a Plate.

The purpose of this journey is spontaneous conversation. A casual food photo does not become a Plate merely because it depicts food or later proves useful.

## Journey 2 — Promote Table material to a Plate

1. An author's Table contribution develops enough value that they decide it is worth sharing more deliberately.
2. They choose a `Promote to Plate` action on their own material.
3. The selected material becomes the starting point for an editable Plate draft rather than a literal one-for-one copy.
4. The author may add, remove, rewrite, or reorganise content, such as adding a recipe, naming a dish, or improving the description.
5. They publish the resulting Plate to the feed.
6. The original Table contribution remains connected to the resulting Plate in a form still to be designed.

Confirmed on 2026-09-26: Plate discussions within Tables act as threads. The same model applies when an existing Plate is brought to a Table. The exact placement and visual treatment of the thread entry remain interface-design details.

## Journey 3 — Browse a Plate and bring it to a Table

1. A person encounters a deliberately published Plate in their feed.
2. They may appreciate it, save it, or decide that they want to discuss it with particular people.
3. They use `Bring to Table` and choose one Table. The first version supports one destination per share action, with no multi-Table selection.
4. They may add an introductory message such as a question or suggestion.
5. The Table receives a reference to the original Plate rather than a duplicate, presented within the ordinary conversation.
6. The shared contribution offers `Reply in thread` before replies exist and displays the reply count once they do. Opening it leads to that Table's focused discussion.
7. Discussion belongs to that Table. The same Plate may generate separate conversations in several Tables through separate sharing actions.

Confirmed on 2026-09-29: sharing the same Plate into the same Table again creates a new share and a new discussion thread. Do not reopen or merge with a previous share's discussion. The original Plate remains the same referenced contribution.

A Table is not restricted to Plate discussion, and a Plate does not require a Table. The relationship is many-to-many.

Confirmed on 2026-09-26: discussion of the Plate takes place in a thread within that Table. Threads in different Tables remain separate and private to the members of their respective Tables.

The owner's first wireframe, reviewed on 2026-09-27, shows feed → Table selector → optional introductory message and share action → shared Plate in the main conversation → thread. The owner confirmed single-Table selection for MVP and `Reply in thread` followed by a reply count. The miniature feed card in the sketch is a drawing shortcut: the intended interface should use a readable compact Plate preview with original author, category, short text, and an image where present. The person sharing into the Table remains distinguishable from the original author. Detailed styling remains open; this is a reviewed wireframe, not a tested prototype.

### Plate creation and optional discovery information

Publishing requires a broad category such as Meal, Recipe, or Restaurant, as clarified by the owner on 2026-09-26. Beyond that category and the contribution itself, additional tags and information are optional. This corrects the earlier interpretation that low-friction posting meant no categorisation. The final category list and whether multiple broad categories are allowed have not been decided. Author identity remains a retrieval cue even for an otherwise sparse Plate. Content-based tag suggestions are a desirable later enhancement, provisionally outside the MVP, rather than a prerequisite for useful search.

## Journey 4 — Make and answer a Request

1. A person asks for a food idea or recommendation.
2. They post a formal, visibly labelled Request in one Table. Feed broadcast is deferred.
3. People reply in its dedicated thread. Any member can save the Request to their Menu and later reopen the ongoing discussion, including new answers, subject to continued Table access.
4. Conversations occurring in separate locations remain separate; the product does not attempt to merge every answer into one universal thread.
5. The asker may take no further action, report back conversationally, or publish a resulting Plate that references the suggestion.
6. No selected answer, resolved state, or resulting Plate is mandatory.

The Request and its answers may remain useful after the asker's immediate need has passed, even if the asker never reports an outcome.

Reviewed wireframe refinements: preserve the question's supporting context after posting; show `Reply in thread` and then reply count; allow saving directly from the main Table card and confirm `Saved` in place. The Menu entry shows the asker, source Table and `Open discussion`. The owner's October 1 Excalidraw version is the current visual reference; no usability test has occurred.

## Journey 5 — Save something useful and return to it

Design boundary: saving an individual reply would retain that message in the Menu without creating any new thread. The assistant's recent example concerned a recipe reply inside an existing Plate thread. The message-save controls, exact eligible scope, and resulting Menu presentation still require discussion with the owner; the existing wireframe demonstrates saving the original Plate only. The steps below preserve the earlier conceptual save and category decisions, not an approved message-save interface or a blanket thread-per-message model.

Wireframe observation (2026-09-28): the owner supplied close-ups showing a save action beside the shared Plate at the top of its Table thread. The Menu shows that Plate's image, category, attribution, caption/tags, and its source Table; a return arrow points from that source link back to the Plate's discussion. This demonstrates saving the Plate with its Table context, not saving a reply or the entire thread.

Owner-confirmed refinements (2026-09-28): show the original Plate author at the top of the saved item. Include the person who shared it into the Table alongside the source Table and an explicit `View Table discussion` action. That action returns to the particular Plate discussion where the saver encountered it, rather than merely opening the Table. Saving keeps the person in the current discussion and changes the save control to `Saved`; opening the Menu is a separate action. Detailed layout remains open.

Owner-confirmed lifecycle (2026-09-29): the Menu retains a captured representation from the time of saving. Revisiting the original Plate loads its current state, including later edits. If the original is removed, the captured Menu item remains as a reminder of the saved idea; it does not recreate a live original or its discussion. The exact captured fields and image resolution are still to be specified. A retained thumbnail requires a retained media asset rather than only a link to an image that disappears with the original. Behaviour following access changes is not established by the ordinary-removal decision.

1. A person encounters food content they may want to cook, visit, buy, or remember.
2. Saving a Plate retains its existing category without another categorisation step. Earlier discussion proposed saver-selected categories for uncategorised Table contributions; that case is conditional on resolving message-save scope and is not part of the current baseline.
3. The saved material becomes accessible through the person's Menu.
4. The initial Menu offers all saved items, search, and organisation by broad category. Extra personal subcategories and collections are deferred beyond MVP; `Taster Menus` remains an unconfirmed name for a possible later capability.

Current save behaviour: a person can save a Plate reminder or a formal Request's ongoing discussion. Plate saves are unique per saver/Plate; another explicit source save adds a discussion reference without duplicating the item or refreshing its snapshot. Ordinary Plate removal preserves reminders; broader removal is reserved for account deletion/intervention, with details still open. Existing shares show current Plate content with `Edited since shared`; historical-version browsing is deferred. Earlier conceptual discussion of individual reply saving remains historical context pending that separate decision. A personal save does not publish private content or expand its audience.

The sea-bass scenario originally exposed three candidate models:

1. Save the original Plate.
2. Save a useful recipe, link, or answer that emerged in the resulting Table conversation while retaining its source context.
3. Enrich the original Plate with the useful follow-up and save that evolving Plate.

On 2026-09-26, the owner confirmed direct saving of useful Table replies alongside Plate saving. Author enrichment is therefore not a prerequisite for retaining a useful reply. A saved Table contribution presents the useful content itself and who shared it, with an easy action that returns to the original contribution in its source conversation. The owner cited Slack as an interaction reference for returning to the original location, not as an integration or dependency. Detailed visual presentation and handling of later source edits or access changes remain to be designed; a save does not grant additional access to the source.

The same Plate may be useful for several purposes, but its publisher must supply a broad category. The owner confirmed this category as the basis for Menu sorting, with no further personal subcategorisation required for MVP. Saving a Plate retains its existing category without asking the saver to choose it again. When saving useful material directly from a Table reply that has no Plate category, the saver chooses a broad category for their saved item. This is personal organisation of the save; it does not categorise the original message for everyone or promote it into a Plate. Ordinary Table messages remain free from required categorisation.

The first two prospective-user responses are recorded in `PRODUCT_DISCOVERY.md`. They describe recipe retention, keyword and visual rediscovery without a prior save, and image browsing for inspiration. Publisher categorisation is an owner decision, not a finding established by those responses. Further feedback can refine the design.

## Journey 6 — Search and retrieve food knowledge

1. If a person deliberately saved something, they can return to it through their Menu.
2. If they did not save it, they can search Plates using terms such as an ingredient, dish, restaurant, or location.
3. The longer-term product direction is app-wide search across content the person can access, including relevant Plates, Table messages, Requests, URLs, captions, and other available text or metadata.
4. Search should use information that already exists rather than imposing exhaustive tagging on publishers or other participants.
5. Image-based classification, semantic interpretation, and automatic recipe extraction are not required to validate the MVP.

Confirmed on 2026-09-26: users should be able to search Plates they have access to and search within Tables they belong to. Tables and their threads remain private to their members; sharing a Plate does not expose the discussions of it in other Tables. Searching Plates by the posting person's name must support rediscovery even when no tags or descriptive information were added. Authors can optionally add a few tags to help discovery.

Access confirmed (2026-09-29): the owner agreed to avoid private author-profile complexity in MVP. Opening a shared Plate does not require following its author; a Follow option remains available. Private Table membership is a separate rule protecting discussion, media, and search. Public logged-out browsing has not been decided; the scope draft proposes a signed-in first version.

The searchable content boundary is now established, while search presentation remains open: a single combined search across Tables has not been agreed. Ordinary text and optional-tag matching are proposed alongside confirmed author-name lookup. Basic image browsing within a Table is confirmed for MVP, using a chat media view as the interaction reference. It covers casually shared images as well as deliberately published Plates shared into the Table, without making media public. The owner cited WhatsApp's chat media view as a reference, not an integration or a commitment to every media type it supports. An untagged photo may be found through its author and broad category but need not be discoverable by its depicted ingredients. Content-based tag suggestions are provisionally deferred beyond MVP.

## Cross-journey consistency check

- Low-friction sharing remains consistent: ordinary Table messages require no structure, and Plates may remain lightweight.
- Deliberate action remains the boundary: casual Table material does not silently enter the feed.
- Feed content is deliberate; broadcast Requests remain a later extension beyond initial Table Requests.
- Conversation stays contextual: replies remain where the Plate reference or Request was posted rather than being globally merged.
- Utility may emerge after sharing: questions, answers, recipes, and outcomes can make initially sparse content more useful.
- No journey requires mandatory follow-up, exhaustive tags, image analysis, or a polished contribution.
- A personal Menu save captures a Plate without changing its original authorship or publishing status. Plates retain their publisher-selected category when saved. The earlier Table-reply save/category concept remains conditional on the unresolved message-save scope.

## Remaining decisions before the MVP boundary

1. Begin the local foundation after branch/setup approval, using [STACK.md](STACK.md). Remaining wireframes do not gate implementation.
2. Translate the first Plate loop into SQL and membership tests, preserving repeat-share threads, one Plate save with multiple sources, captured content, and current original/source navigation.
3. Add the reviewed formal Request/thread/save flow and complete search/media browsing. Settle snapshot limits and destructive lifecycle behaviour before enabling dependent operations. Individual-message saving remains separate.

Further sea-bass responses should be incorporated as they arrive; receiving them is not a prerequisite for any of these steps. Earlier support for direct reply saving is preserved above, but the September 29 clarification leaves that capability unresolved. Plate saving and returning to its particular source discussion remain confirmed.
