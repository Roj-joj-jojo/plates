# Alpha social features — scope and build plan

Updated 2026-10-14. Owner approved the combined open/private model below and requested implementation. Local UI is built and the specifically approved migration is applied locally; candidate and installed rollback verification passed. Owner preview rebuild and browser/device review remain pending. The original recommendations below are retained as historical scope, superseded where they conflict with the approved model.

## Approved model and current implementation

- Accounts default open within the signed-in app. Open accounts can be followed immediately; private accounts require the author to accept a request. No reciprocal follow or automatic Table membership.
- Feed contains approved followed authors plus own Plates, with stable newest-first keyset pagination. Open authors who are not followed remain discoverable through Search/profiles.
- People search exposes name, username, account privacy and avatar, never email or private Table information. Profiles show current authorised Plates and an optional 160-character bio. Private profiles with no approval show a notice instead of Plates/bio.
- Your people provides Following, Followers, Requests and Sent requests with pagination. Authors can accept/decline requests or remove followers; requesters can cancel or unfollow. Version checks reject stale changes, and duplicate accepted retries are idempotent. UI has pending/error/confirmation states.
- Account privacy changes require confirmation: becoming private retains approved followers; becoming open approves pending requests and exposes existing published Plates. Removing/unfollowing does not recall Menu copies. Existing Table memberships and replies remain separate.
- Private Table shares show a neutral Private Plate notice linking to the author when a member lacks approval. Sharing does not grant Plate access. Existing Table discussion remains readable to its members.
- Candidate guards Plate rows, Search through RLS, security-definer photo locations/Storage signing, new saves, preview preparation and shares. Public profile discovery intentionally expands earlier profile-name/avatar visibility, but not Table content.
- Existing Menu snapshots/previews remain available to their saver. Account erasure still overrides snapshots; the new cutoff trigger clears relationship identifiers and bio.
- Fresh Plate photo URLs last five minutes. Previously issued URLs may last until their original expiry (previously one hour), and bytes already downloaded/rendered cannot be recalled. Revocation denies new reads/signing; it is not instant recall of previously delivered content.

### Verification and activation

- Candidate retained: supabase/candidates/20261013000200_follow_privacy.sql. Owner explicitly approved exclusive copy to supabase/migrations/20261013000200_follow_privacy.sql, sole-pending local migration check, application and installed suite. CLI confirmed this was the sole pending migration and applied only this file. Installed rollback suite passed. No new dependencies or workers required.
- Prepared rollback tests: supabase/tests/follow_privacy.sql and scripts/test-follow-privacy.mjs. Scope: four synthetic accounts, one Table/share, 35 Plates including one metadata-only photo, one Menu snapshot and synthetic recorded account cutoff. Owner explicitly approved the run. Initial sandbox run could not reach Docker; approved escalation passed. A second pass including public profile identity/avatar and private Table-avatar checks also passed. All candidate schema/settings/fixtures rolled back; no Storage uploads/deletions or actual Auth deletion.
- Final lint/typecheck and in-memory Tailwind compilation passed before activation; application code unchanged afterward. Script TypeScript parsing passed. Installed-schema rollback tests passed after activation. Full build, real simultaneous races, signed-URL expiry and browser/device review remain pending.
- Existing picture SQL regression now checks profile visibility according to the installed discovery feature: old schema hides unrelated profiles; new schema exposes chosen-username profile avatars. Private Table-avatar assertions stay unchanged. That existing suite has not been rerun with the new candidate.
- First-run introduction, URL previews and camera integration remain separate backlog tasks.

## Recommended alpha scope: one-way following

- Search offers Plates and People, preserving the current six navigation destinations. People search matches usernames/display names, returns bounded results, and exposes no email, private Table membership or account settings. Active accounts with chosen usernames are discoverable to other signed-in active accounts; this is a deliberate extension of current exact-username lookup.
- People results and existing person pages offer Follow/Following and Unfollow. No self-follow, automatic reciprocal follow, follow request or private-message feature.
- A Following list provides a way to revisit people and unfollow them, reachable from Search/Account without adding another main navigation destination.
- Feed shows available Plates by followed active authors plus the viewer's own Plates, newest first. Explain the no-follow and followed-authors-with-no-posts states and link to People search. Preserve Add a Plate, photo rendering and Save to Menu.
- Following selects the Feed; published Plates remain accessible through existing signed-in Search/direct links/Table shares. Unfollowing must not erase Menu saves or change Table membership.
- No automatic follow notifications or changes to Mentions in this slice.
- First-run introduction is a subsequent task once this journey works. Recipe URL previews and camera recognition remain separately backlogged.

## Alternative requiring wider scope

If the owner selects private Plates with approved followers, scope must first define requests/acceptance, audience changes, resharing to Tables containing non-followers, signed media access, existing Menu reminders and revocation. The Feed-only model above cannot be presented as private-content enforcement. Do not implement either access model before the pending decision is answered.

## Existing foundations inspected

- Feed currently selects newest 30 available Plates without relationship filtering. The migration's plates_read policy permits authenticated active app profiles.
- Search currently searches Plates only; its existing copy mentions people but has no account-discovery results.
- Existing /people/[profileId] resolves profiles through current restricted visibility and shows picture/name/username. Discovery needs an explicit guarded account lookup, rather than broadening mention resolution by accident.
- Picture signing currently follows private.can_read_profile. People without published Plates/shared Tables may need narrowly scoped picture-discovery access under the agreed model; do not expose Table pictures or unrelated media.
- Exact-username Table addition grants membership immediately. Following must not alter that behaviour.

## Local implementation sequence after scope decision

1. Prepare an additive candidate schema and authenticated operations for discovery, follow state/list and selected Feed. Guard actor identity server-side, validate inputs and enforce self-follow/uniqueness. Reuse profile-before-content locking and existing account lifecycle conventions.
2. Use reversible active/inactive relationship state for Unfollow, avoiding physical relationship deletion. Integrate account cutoff/erasure so relationship identifiers do not escape existing erasure requirements; any activation affecting existing records needs specific approval.
3. Prepare readiness-gated UI with the existing black headers, navigation rail, typography, buttons and avatars. Do not silently fall back to the app-wide Feed when following is unavailable.
4. Run previously authorised lint/typecheck; seek exact approval for new rollback database tests. Tests must exercise different actors' lists/feeds, duplicate retries, Unfollow, self-follow denial, inactive-account denial, anonymous/direct-write denial and private Table separation. Retain all existing work.
5. Seek specific local migration approval only after the candidate/tests are concrete and reviewed. Apply only the intended migration after checking pending versions; then test the installed schema with separately approved rollback fixtures.
6. Owner rebuilds/restarts their preview, then checks separate-account Search/Follow/Feed/Unfollow, photos, saves and empty states. Record checks and limitations in HANDOVER.md. No Git/deployment/external action.

No new dependencies are expected for the recommended scope. Feed pagination and concurrent last-intent ordering need consideration during implementation; don't claim a newest-30-only prototype covers an unlimited Feed.
