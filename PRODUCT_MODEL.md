# Plates — Product Model v1

Working model · updated 2026-10-06

2026-10-22 Menu navigation clarification: the owner approved Saved (default) and Your Plates as the main Menu views, with Removed items a secondary destination under Saved. Your Plates provides access to the signed-in person’s live published posts and existing detail/edit controls; it does not create saved copies. Saved Plate snapshots and saved Request references retain their existing semantics. Profile Plate lists remain available. Dinnerfolk is now the app’s public name; historical Plates branding in this document is retained.

2026-10-14 decision clarification: owner approved open accounts by default and optional private accounts with approved followers. Following selects the Feed; private-account Plate viewing is also permission-gated across Search, direct links, Table previews and photos. Existing followers remain approved on making an account private; opening approves pending requests after confirmation. Existing Menu copies remain, while Table membership stays separate. This supersedes the older no-private-profile/follower-gate wording below. Local activation and candidate/installed rollback checks passed, alongside code checks; owner preview rebuild/browser review is pending. See SOCIAL_ALPHA_PLAN.md for the current scope and limits.

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

- Connected use is signed-in only, with no logged-out browsing. No private author profiles or follower gate: following is not required to open a shared Plate. Tables and discussions remain private to active members, who see full earlier history.
- A Plate may contain text, links, images, or a combination. Publishing requires exactly one category: Meal means what you ate; Recipe means how to make it; Place means where to go. Optional tags carry overlap.
- The requested Meal-to-Recipe direction creates a second Plate, preserving the original Meal, discussions and saves. Each post has its own content/category. A dedicated shortcut and cross-link presentation remain to be designed.
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
| Plate saved | Captures body, links, tags, category, author name, revision/time and one per-save preview where present. | Links to live Plate and the specific Table share when saved there; a stale first-save revision asks for a refresh. |
| Author edits Plate | Captured representation remains. | Live Plate shows its latest state; existing shares show `Edited since shared` when applicable. Historical-version browsing is deferred. |
| Author renamed | Saved author name remains frozen at save time. | Current profile uses the new name. |
| Original Plate ordinarily removed | Captured reminder and retained preview remain. | Shares show “no longer available”; existing replies remain visible to active members. |
| Author content erased | Affected reminders become blank removed stubs, including saved names and images. | Affected originals are blank; independent replies are not automatically erased. |

A saved item does not publish private conversation or grant access to another Table. Former members retain Plate reminders but lose resolved source labels and context, including Table names, sharer details and replies. Joining is invite-only, initially with owner-only invitations. The invite UI says “New members can see earlier conversation.” Leaving preserves past messages as “former member” within that Table; the last owner must transfer ownership before leaving. Savers may unsave or remove one source. The first release permits Table archiving rather than deletion; precise archive semantics remain to be specified.

Broader removal of saved copies is reserved for account deletion and intervention cases, rather than a normal author-facing `Delete everywhere` action in MVP. Adopt “erased means blank” as the default, overriding frozen reminders and attribution. Full operation design, complaint handling, physical assets, backups/caches and appropriate advice remain prerequisites before real-user invitations. This policy does not enable deletion endpoints. A saved Request is a live discussion reference, not a frozen copy of answers.

Blocking/reporting must be considered in the architecture, but their user-facing workflows are deferred for the initial friends-only release. Exact blocking behaviour in shared Tables is not yet agreed.

## Direction retained, details still open

Authors may promote their own Table material into an editable Plate draft; detailed first-version scope remains open. Requests can remain unanswered, receive conversational follow-up, or lead to a Plate; no mandatory resolved state or selected answer is required. The Table Request/save flow has now been reviewed in generated and owner-drawn wireframes; this is not a usability test.

Individual-message saving remains unresolved following the owner's September 29 clarification. Earlier conceptual support is preserved in the journey history. It is excluded from the baseline draft until separately agreed; saving a Plate does not save its replies as individual Menu items.

## Choices to settle through the next designs

1. Publishing controls and the shortcut for an author to create a second Plate in another category; the category rule itself is settled.
2. Supporting interfaces for owner invitations, passwordless email signup and feed selection. History access is settled.
3. Detailed archive/removal operations, promotion scope and the separate question of individual-message saving.

The October 5 D1–D9 feedback was recorded on October 6. [DATA_MODEL.md](DATA_MODEL.md) holds the canonical limits and decision register, including initial media defaults, signup validation and the pre-invitation erasure gate. Realtime waits until M7; refetch on focus/pull-to-refresh comes first.

Further friend responses and remaining wireframes do not block implementation. The owner chose the stack and asked to begin a working prototype; see [STACK.md](STACK.md).
