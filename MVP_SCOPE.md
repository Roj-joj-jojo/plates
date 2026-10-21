# Plates — MVP Boundary

Working boundary · updated 2026-10-06

2026-10-14 alpha requirement: People search, follow requests/approval, open/private account settings and a followed-author Feed are required before alpha. Default-open accounts allow immediate following; private accounts restrict originals to approved followers. Table membership is separate and saved Menu copies persist. This supersedes the older following/visibility exclusions below. Local activation and candidate/installed rollback checks passed, alongside code checks; owner preview rebuild/browser/release verification remains pending. See SOCIAL_ALPHA_PLAN.md.

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

## Supporting scope — agreed defaults and remaining proposals

- Signed-in only, passwordless email, and a required display name validated at signup. Email one-time code is the implementation default from the offered code/magic-link options. Table joining is invite-only, initially by owners; active members see full earlier history with a clear invite warning. Former members lose source context but keep Plate reminders.
- Members may leave, with past messages labelled “former member”; the last owner must transfer ownership first. Unpublished Plate shares retain their replies and show “no longer available”. Savers may unsave/remove a source. Archive Tables instead of deleting them in the first release; detailed archive semantics and lifecycle operations remain to be designed.
- A chronological feed of followed authors' Plates, with shared Plates opening independently of following. This is a suggested starting rule, not a confirmed feed algorithm. Broadcast Requests are deferred.
- Ordinary keyword matching over available text/tags plus author lookup. Search inside one chosen Table, including its Plate-thread replies; a single combined cross-Table results page can wait unless the next wireframes justify it.
- Promotion of one's own Table material remains a product direction with detailed first-version scope open. Table Requests and their saved discussions are now agreed, with reviewed wireframes. Private source messages must not become visible to non-members merely because their author publishes a derived Plate.
- Implement the agreed captured reminder, frozen author name and per-save preview, with the text/media defaults in [DATA_MODEL.md](DATA_MODEL.md). The erasure default blanks affected originals and saved copies to stubs; the complete operation, assets and backup/cache handling are a pre-real-user gate.

## Unresolved; outside the baseline until agreed

- Saving individual messages or arbitrary discussions. Formal Request discussion saves are the specific agreed exception.
- Detailed archive/erasure operations and the interface for an author to publish a second Plate in another category. Snapshot fields, one required Meal/Recipe/Place category, and initial media limits are now settled or adopted defaults in D1–D4.
- Detailed reactions and notification behaviour. Existing sketches and journeys mention reactions; they do not define a complete notification system.

## Deferred or not assumed

- Realtime until M7; start with refetch on focus/pull-to-refresh. Future private notifications carry IDs only and trigger protected refetch, with revocation tests before enabling them.
- Private author profiles and follower-only Plate visibility.
- Feed Requests; user-facing blocking/reporting in the initial friends-only release. Keep access enforcement and removal support extensible; detailed blocking rules remain open.
- Historical Plate-version browsing. Existing shares show the live Plate plus `Edited since shared`; Menu snapshots stay unchanged.
- Sharing to multiple Tables in one action.
- Personal Menu collections/subcategories.
- Content-based tag suggestions, image recognition, semantic search, automatic recipe extraction.
- Maps and deep restaurant integrations.
- Arbitrary message threads, nested threads, and automatic copying of a thread into a Menu item.

## First implementation slice — local status

The text/link loop is implemented locally: publish a Plate → bring it to a private Table → discuss it → save it → find it in Menu → reopen the current Plate or return to the exact discussion. The owner confirmed this flow in the browser on 2026-10-08. D1–D3 are resolved; remaining wireframes do not block later work.

Owner testing confirmed editing the current Plate with `Edited since shared` and an unchanged saved Menu copy. Populated HTTP testing confirmed non-member Table/discussion denial and same-session concurrent retry identity. Original-author versus sharer display needs a focused owner check; repeated deliberate shares, removal retention, a second Table member, different-session races and the image case remain future acceptance scenarios. No usability study has occurred.

The first slice is smaller than the full MVP. Formal Requests, search, image browsing, and other included journeys must still be completed before calling the MVP complete. The owner explicitly chose to move into implementation without waiting for remaining wireframes. The mobile-friendly Next.js/Supabase stack and first build sequence are recorded in [STACK.md](STACK.md); branch confirmation and dependency permission are required before setup/code work.
