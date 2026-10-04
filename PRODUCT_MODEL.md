# Plates — Product Model v1

Working model · updated 2026-10-04

This consolidates confirmed behaviour; it is not a declaration that the complete MVP is approved or implemented. Scope proposals live in [MVP_SCOPE.md](MVP_SCOPE.md), and proposed storage relationships in [DATA_MODEL.md](DATA_MODEL.md). The six journeys and their history remain in [USER_JOURNEYS.md](USER_JOURNEYS.md).

## Purpose and core objects

Plates helps friends share food experiences, discuss them, and recover useful ideas later. Text, links, and images can each carry the contribution; a photograph is not required.

| Object | Meaning |
| --- | --- |
| Plate | A contribution its author deliberately publishes. It requires a broad category; extra tags and structured information are optional. |
| Table | A private, persistent group conversation. Ordinary messages need no category and do not automatically become Plates. |
| Plate share | One occasion on which someone brings an existing Plate to one Table, optionally adding an introduction. |
| Plate discussion | The thread belonging to that particular share. A repeat share starts a fresh discussion. |
| Menu item | Either a captured Plate reminder with source references, or a saved Request that opens its ongoing discussion. |
| Request | A visibly labelled formal question in one Table, with its own thread. Members can save it and revisit later answers. Feed Requests are a later extension. |

## Confirmed behaviour

- No private author profiles in the initial version. Following is not required to open a shared Plate; an unfamiliar author can have a Follow action. Tables and their discussions remain private to members. This does not decide logged-out web access.
- A Plate may contain text, links, images, or a combination. Publishing requires a broad category such as Meal, Recipe, or Restaurant. The exact list and whether more than one category is allowed remain open.
- A Plate can be shared into several Tables through separate actions. Each action has one destination and creates a new share and thread, including repeated shares to the same Table.
- A share preserves the distinction between the original author and the person bringing it to the Table. Its thread entry says `Reply in thread`, then shows a reply count when replies exist.
- Shared Plates and formal Requests each have dedicated threads. Saving a Request retains access to its ongoing discussion; arbitrary message threads, nested threads and saving individual replies remain outside the agreed baseline.
- One Menu item per saver and Plate. First save captures the reminder; explicitly keeping another discussion adds a source reference without refreshing the snapshot. Repeating the same source adds nothing. Distinguish `Already in your Menu` from `Keep this discussion as another source`.
- Formal Table Requests are visually distinct from casual chat. Their question and supporting context stay available. Offer `Reply in thread`, then a reply count, plus in-place `Save to Menu` / `Saved`. The Menu shows the asker, source Table and `Open discussion` action; opening includes later answers and still requires Table access.
- Saving a Plate retains its category and confirms `Saved` in place. Opening the Menu is a separate action. Initial organisation uses broad categories; personal collections are deferred.
- The Menu shows original authorship. A Table source includes the sharer and an explicit `View Table discussion` action returning to the particular discussion, not just the Table.
- Users can search accessible Plates, including by author name, and search within their Tables. Basic Table image browsing supports both rediscovery and inspiration. A combined search across every Table is not yet specified.

## Saved representation versus live original

| Event | Menu item | Opening original/source |
| --- | --- | --- |
| Plate saved | Captures the Plate as encountered; exact captured fields remain to be agreed. | Links to live Plate and the specific Table share when saved there. |
| Author edits Plate | Captured representation remains. | Live Plate shows its latest state; existing shares show `Edited since shared` when applicable. Historical-version browsing is deferred. |
| Original Plate ordinarily removed | Captured reminder remains, including retained preview media where provided. | Cannot reopen the removed Plate. Treatment of its remaining Table discussion still needs definition. |

A saved item does not publish private conversation or grant access to another Table. Source navigation must respect current membership. Leaving a Table and other access changes need their own behaviour definition; the ordinary Plate-removal decision does not settle them.

Broader removal of saved copies is reserved for account deletion and intervention cases, rather than a normal author-facing `Delete everywhere` action in MVP. Snapshots and retained media must be removable through that path; exact account-deletion, complaint review, erasure and backup handling still need definition. A saved Request is a live discussion reference, not a frozen copy of answers.

Blocking/reporting must be considered in the architecture, but their user-facing workflows are deferred for the initial friends-only release. Exact blocking behaviour in shared Tables is not yet agreed.

## Direction retained, details still open

Authors may promote their own Table material into an editable Plate draft; detailed first-version scope remains open. Requests can remain unanswered, receive conversational follow-up, or lead to a Plate; no mandatory resolved state or selected answer is required. The Table Request/save flow has now been reviewed in generated and owner-drawn wireframes; this is not a usability test.

Individual-message saving remains unresolved following the owner's September 29 clarification. Earlier conceptual support is preserved in the journey history. It is excluded from the baseline draft until separately agreed; saving a Plate does not save its replies as individual Menu items.

## Choices to settle through the next designs

1. What a saved reminder contains: proposed fields and media handling are in the data-model draft.
2. Finalise publishing controls around the working Meal, Recipe and Place choices, with Request as a separate contribution type. One category plus optional multiple tags is the proposed initial implementation; category multiplicity has not had a separate explicit confirmation.
3. Supporting flows: joining Tables, feed selection, and access to prior Table history.
4. Promotion scope, removal lifecycle, and the separate question of individual-message saving.

Further friend responses and remaining wireframes do not block implementation. The owner chose the stack and asked to begin a working prototype; see [STACK.md](STACK.md).
