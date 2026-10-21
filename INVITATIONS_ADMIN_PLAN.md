# Invitations and Table administration

Updated 2026-10-11. The owner selected a simple owner-managed email allowlist for app admission, with an easy in-app management screen. It is applied and activated locally for the verified selected owner; SQL/app checks passed as recorded in `APP_ACCESS_ALLOWLIST.md`. Direct-add Table/Admin controls are now applied locally and passed SQL/app and retained local Auth/RPC tests. The latest synthetic runtime test also passed allowlisted local account creation; browser management remains separately assessed.

## Current direction — direct additions

The owner superseded the invitation/acceptance proposal below on 2026-10-11. An Admin selects existing accounts by exact username when creating a Table or later in Members; people join immediately and can see previous conversation. No invitation tokens or acceptance flow is needed for this Alpha. Members can leave; Admins can add/remove members and appoint/demote Admins. The last Admin must either assign another current member and leave atomically, or close the Table for everyone. Closing retains Table/content records, ends memberships and prevents access. No automatic emails or push notifications.

Migration 20261011000400 and Members/create UI are applied locally; candidate/installed rollback SQL and real local Auth/RPC acceptance passed direct addition, member permissions, Admin changes, last-Admin protection, atomic replacement and retained closure. Browser acceptance remains pending. Locks take profiles in ID order before the Table; closure checks for membership changes before proceeding. Exact username lookup returns only the selected active account’s username/display name/ID; no email or browse-all directory. Existing Table-owner terminology remains Admin in the UI. Earlier invitation-token text below is historical proposal, not current scope.

## Existing foundation

`group_memberships` records a profile's role (`owner` or `member`) and current state (`active`, `left`, `removed`) for one Table. The interface calls `owner` **Admin**, as previously agreed. Multiple active Admins are already supported. `membership_periods` preserves join/leave history; a rejoin appends a new period. Available Tables must retain an active Admin. Guarded operations must lock affected profiles in ID order, then the Table, before membership changes.

Existing local signup is open. A hidden signup button is insufficient to make the hosted trial invitation-only; the admission check must also reject direct Auth signup requests. Existing unrelated profile names must not become discoverable through an invitation picker.

## Proposed first flow

1. The app owner allows an email address through **Account → Manage app access**. They share the normal app address themselves; no separate app invitation token/email system is needed. Table Admin authority does not grant app-wide admission authority.
2. A Table Admin creates an invitation for an admitted person. Admission and Table membership are separate: an app invitation does not expose a Table or automatically join one.
3. The recipient signs in and explicitly accepts the Table invitation. Match the invitation to the verified Auth identity, never a browser-supplied recipient ID. Explain **New members can see earlier conversation** before acceptance.
4. The Members screen lists only members of that Table, labels Admins and lets an Admin appoint another active member as Admin or demote an Admin. Reject demoting/leaving the last active Admin. App admission and billing status confer no Table administration rights.
5. Members may leave; Admins may remove a member. Close the current membership period and retain structural rows/content. A removed person must receive a fresh invitation before rejoining. Ordinary departure/removal does not erase their contributions or retained Menu reminders; source access follows current membership rules.

Table invitations should expire, support revocation and have one-use, unpredictable tokens stored as hashes. Repeated acceptance should return the same membership result without creating overlapping periods. Concurrent acceptance, revocation, role changes and last-Admin departures must preserve the existing locking/invariant rules. Never display tokens in logs or expose an unrelated membership directory. Manual sharing is sufficient initially; no automatic invitation emails or external messaging is authorised by this plan.

## Admission and erasure compatibility

Prepare a separately reviewed signup guard and bootstrap/operator configuration, without unexpectedly blocking the existing owner's account or legacy local tests. Activation requires specific local migration/configuration approval. Existing active accounts need an explicit preservation/admission policy; do not silently disable them.

New private invitation/admission data must be included in erasure analysis before the migration is applied: recipient email/token associations, inviter attribution and pending invitations cannot silently escape the established account-erasure policy. Additive schema alone does not solve that integration. Do not introduce raw identifiers or emails into the independent deletion log.

## Future paid tiers

The current membership tables model Table access and role, not a paid plan. Later subscriptions/entitlements should be separate and associated with the paying profile, or with a Table if group subscriptions are eventually chosen. Billing state may control specific capabilities/limits while Table membership continues to protect private content. Paying must not confer Admin status or access to another Table. No billing provider, tier, price, subscription schema or dependency is selected or implemented in this slice.

## Implementation and acceptance sequence

1. Settle admission authority and preserve existing accounts; prepare the migration and guarded endpoints locally on the owner-confirmed feature branch, without Git operations.
2. Add invitation acceptance and Table Members/Admin controls using the existing UI/server conventions. Keep signup/admission and Table membership distinct.
3. Seek specific permission for synthetic tests, including rollback-only database fixtures. Cover outsider/member/Admin permissions, invite identity/expiry/revocation/retry, periods, last-Admin preservation and erasure compatibility. Run lint, typecheck and build with permission.
4. Review and obtain exact permission before applying migrations, changing the running admission settings, creating actual disposable Auth/Storage fixtures or performing scoped destructive acceptance. No real recipient messages or hosted access without explicit authority.
5. Verify actual separate-account flows and direct-API denial locally, update HANDOVER.md, then move to visual design. Hosted setup remains separate.
