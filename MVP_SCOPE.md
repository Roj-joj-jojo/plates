# Plates — MVP Boundary

Working boundary · updated 2026-10-04

Confirmed decisions are distinguished from proposed implementation scope. This is a planning boundary, not a build authorisation or a frozen feature list. See [PRODUCT_MODEL.md](PRODUCT_MODEL.md) and [DATA_MODEL.md](DATA_MODEL.md).

## Established core

| Capability | Initial boundary |
| --- | --- |
| Publish and revisit Plates | Text, links, and images; required broad category, optional tags; reopening loads current content. No private author profiles or follower access gate. |
| Feed and following | Browse deliberate contributions and follow authors. Feed selection/order still needs a proposed rule. |
| Private Tables | Ordinary group conversation and sharing Plates with one destination per action. Each share starts its own thread; repeated sharing creates another. |
| Discuss a shared Plate | Readable preview, original author and sharer distinguished, thread replies and reply count. |
| Formal Table Requests | Visually distinct question with supporting context, one Table destination, dedicated discussion, and save action. Saved Requests reopen the current thread, including later answers, subject to membership. |
| Table image browsing | A basic media view for casually shared images and images on shared Plates. No image recognition required. |
| Save Plates to Menu | One item per saver/Plate, captured at first save; additional explicitly saved discussions become source references without refreshing content. Show original author and source sharer. Ordinary original removal leaves reminders; broader removal must remain possible. |
| Rediscover | Menu browsing/search, author-name Plate lookup, search accessible Plates and within member Tables. Exact search controls remain to be designed. |

## Proposed supporting scope — review before implementation

- A signed-in first version with basic identity, Table creation and invitations, membership, and an owner-managed membership flow. This is a proposed minimum to make private Tables usable; login method, roles, leaving/removal, and history access are not yet selected.
- A chronological feed of followed authors' Plates, with shared Plates opening independently of following. This is a suggested starting rule, not a confirmed feed algorithm. Broadcast Requests are deferred.
- Ordinary keyword matching over available text/tags plus author lookup. Search inside one chosen Table, including its Plate-thread replies; a single combined cross-Table results page can wait unless the next wireframes justify it.
- Promotion of one's own Table material remains a product direction with detailed first-version scope open. Table Requests and their saved discussions are now agreed, with reviewed wireframes. Private source messages must not become visible to non-members merely because their author publishes a derived Plate.
- Specify editing, ordinary removal, unavailable originals, membership changes, and retained Menu previews before implementing their dependent storage operations.

## Unresolved; outside the baseline until agreed

- Saving individual messages or arbitrary discussions. Formal Request discussion saves are the specific agreed exception.
- Exact Plate snapshot fields/preview resolution, final category controls/multiplicity, and account/intervention removal handling. Duplicate Plate saves now retain one item and multiple explicit sources.
- Detailed reactions and notification behaviour. Existing sketches and journeys mention reactions; they do not define a complete notification system.

## Deferred or not assumed

- Private author profiles and follower-only Plate visibility.
- Feed Requests; user-facing blocking/reporting in the initial friends-only release. Keep access enforcement and removal support extensible; detailed blocking rules remain open.
- Historical Plate-version browsing. Existing shares show the live Plate plus `Edited since shared`; Menu snapshots stay unchanged.
- Sharing to multiple Tables in one action.
- Personal Menu collections/subcategories.
- Content-based tag suggestions, image recognition, semantic search, automatic recipe extraction.
- Maps and deep restaurant integrations.
- Arbitrary message threads, nested threads, and automatic copying of a thread into a Menu item.

## First implementation slice — proposal

After reviewing the model and mapping screens, build one complete loop: publish a Plate → bring it to a private Table → discuss it → save it → find it in Menu → reopen the current Plate or return to the exact discussion.

Use that loop to check original-author versus sharer attribution, repeated shares producing different threads, saved content surviving later Plate edits/removal, and Table membership protecting discussion content. Include a text-only example as well as an image example. These are future acceptance scenarios; no implementation or usability testing has occurred.

The first slice is smaller than the full MVP. Formal Requests, search, image browsing, and other included journeys must still be completed before calling the MVP complete. The owner explicitly chose to move into implementation without waiting for remaining wireframes. The mobile-friendly Next.js/Supabase stack and first build sequence are recorded in [STACK.md](STACK.md); branch confirmation and dependency permission are required before setup/code work.
