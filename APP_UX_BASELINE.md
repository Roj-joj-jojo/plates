# Dinnerfolk interface and copy baseline

Agreed with the owner; updated 20 October 2026. Apply each convention across equivalent screens when adding/changing UI. Search for and update equivalent old wording as part of the change. Preserve meaningful distinctions, access rules and saved-copy behaviour. The baseline is not permission for Git, data cleanup, new features or unrelated refactors.

## App identity — 22 October 2026

Dinnerfolk is the app name. Plates remain posts; Tables, Menu and Requests retain their existing meanings. Use approved wordmark A and icon C from [the branding notes](design/dinnerfolk-branding.md), with the shared BrandWordmark component for app logos. Browser titles, onboarding, sign-in, account-access copy and local email templates use Dinnerfolk. Historical/internal Plates identifiers are retained. Hosted email settings require a separate owner-controlled update.

## Names and actions

- **Add a Plate** creates a new Plate; busy state **Adding…**. **Share to a Table** shares an existing Plate. **Unpublish Plate** remains its separate removal action. Do not use Publish as a competing creation label.
- **Ask the Table** creates a **question** in that Table; primary action **Post question**. Saved in Menu, it is a **Request** opening the live Table discussion, not a frozen Plate snapshot.
- **Manage your people** is the repeated People-management link. Preserve a useful pending-request count alongside it.
- **Edit message**, **Edit reply**, **Edit question**, **Edit share note**: sheet/menu/inner editor name the actual contribution. Backend kind identifiers need not mirror visible nouns.
- **Deselect** removes a person from a pending selection. **Remove from Table** changes actual membership. Use a neutral example such as **@sam_cooks**.
- Use **photo/photos** in user-facing text, including **Profile photo** and **Table photo**. Existing internal Picture types/RPCs/storage names remain unchanged. File chooser controls use app-labelled Choose a photo/Choose photos; internal file mechanics need not be exposed.

## Forms and keyboard

- Plate create/edit use **Plate text (optional with links or photos)** and shared **Links (optional, one per line, up to 10)**. Optional share notes/supporting context are marked optional. A message/reply still requires text, links or an existing photo; blank supporting context/share notes remain valid. Do not reject valid photo-only/link-only edits.
- Table chat: Enter sends, Shift+Enter inserts a line. Selecting a mention with Enter selects the suggestion first. Respect composition/IME and in-flight guards.
- Other multiline writing forms: button submits, Cmd/Ctrl+Enter submits, plain Enter inserts a line. Applies to Plate create/edit, original comments/create-edit, bio, Table question/context/share notes/contribution edits/replies. MentionInput handles its shortcut before form fallback. Buttons/single-line sign-in forms retain standard keyboard behaviour.
- Keep labels, touch targets, current focus behaviour and validation. Further accessibility-label audit is deferred post-alpha; existing accessibility features remain.

## Dates and ordering

- Conversation day divider: **Today** for current Europe/London day, otherwise **18 Oct 2026** style. Individual messages show **HH:mm**. Full date/time/timezone remain in accessible labels/tooltips. Server and initial client render must match; refresh day-dependent text after hydration and on calendar-day change/resume.
- Standalone timestamps and notification lists: **18 Oct 2026 · 14:05**; no seconds. Standalone Plate dates can show date only.
- Original Plate comments remain newest first; Table conversation/replies remain oldest first. Label order clearly. A new sorting option/reordering requires a separate decision.

## Feedback and removals

- Use short contextual confirmations, e.g. **Plate updated. Existing Menu copies won’t change.** Reuse constants in src/lib/ui-copy.ts for repeated messages/labels. A saved Request's message explains its live discussion; a linked additional source does not imply another frozen save or merged private replies.
- Transient notices use the desktop lower-right corner and stay above mobile navigation. Their panel must allow clicks through to underlying controls; Dismiss remains interactive. Preserve the status announcement and eight-second reading time.
- Removed content uses **This comment/message/reply/share/question was removed.** Keep existing neutral unavailable-original wording where the cause is unknown. Counts include active content only; removed-history placeholders stay.
- Confirmations name the target and consequence. Use action-specific confirm labels (Remove comment/reply/message/share/question, Remove from Menu, Unpublish Plate). **Cancel** is the neutral default; explicit alternatives such as Keep in Menu/Keep following are valid when they clarify the consequence. No forced universal Keep/Remove vocabulary.
- British English, natural contractions, curly typographic punctuation and en dashes for numeric ranges. Avoid unnecessary serial commas; retain them where clarity needs them. Do not alter literal URLs, usernames, user content or machine identifiers as copy.
- Generic recoverable failure: **Couldn’t save this change. Your draft is still here, so try again.** Give specific actionable validation/access/conflict explanations where known; don’t expose backend diagnostics.

## Onboarding and product boundaries

- Menu has **Saved** (default) and **Your Plates** as its main views. **Removed items** is a secondary link under Saved. Saved retains Plate snapshots and live Request references; Your Plates lists the signed-in person’s live published posts, with detail/edit access and paging. Posts are not automatically saved; profile Plate lists remain available. The introduction explains both Menu views.
- Keep the concept-led Feed/Plates/Tables/Menu/People tour. First-step Back is hidden while its layout space remains. Account is under the avatar menu. Search is explained in People.
- Explain immediate Table addition and earlier-history access honestly. Following and private-original readership are separate; adding someone to a Table does not grant access to a private Plate.
- Bell: follows and original Plate comments. Envelope: Table activity, including mentions/replies. No Table mention double counting.
- Saved Plates keep snapshots; saved Requests open live discussions. Use simple language while retaining the fact that account deletion/erasure can remove retained content.
- Plate tagging/mentions remain unchanged for alpha. Future private-account Table acceptance, navigation tour and deeper mobile optimisation are separate backlog choices.

## Completion check for future changes

Inspect all equivalent rendering/editing/confirmation/onboarding paths. Update shared helpers/constants and matching labels together. Check remaining old strings, accessible names and contextual exceptions. Run relevant local checks and record actual browser/test limits in HANDOVER. Add any newly agreed convention here so it becomes the baseline for later work.
