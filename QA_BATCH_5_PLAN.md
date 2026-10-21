# QA Batch 5 — Notification design checkpoint

**Activation follow-up, 17 October:** Owner approved; seven preflight checks passed, candidate committed locally and copied two eligible mentions preserving read state, schema reload and installed rollback suite passed. Read-only browser readiness/bell separation passed; live two-account acceptance pending. Do not reinstall. See QA_BATCH_5.md; checkpoint text below is historical.

**17 October follow-up:** Both decisions below are now confirmed by the owner: bell/envelope split and visible-rendered-only acknowledgment. Implementation has been prepared and source checks passed; database verification, production build, installation and browser acceptance are pending. See QA_BATCH_5.md. The checkpoint below preserves the original investigation state.

17 October 2026. Owner requested proceeding with notifications. Investigation only so far; no feature/schema/data changes, test commands, worker or service changes in this checkpoint. Two product questions are pending in the chat. Previous same-session feature-branch confirmation exists; no Git used.

## Confirmed scope

- Add follow-request acceptance and grouped Table activity. Preserve immediate Table membership/full earlier history, current original-Plate readership, private Table membership and frozen Menu behavior.
- No new direct-message system, email, push notification, invitation requirement or remote deployment.
- Existing pending follow requests remain actionable rather than disappearing merely because their notification was seen.

## Decisions pending

1. Proposed bell: follow requests/new followers/accepted requests/original Plate comments. Proposed envelope: Table additions, messages, questions, shares, replies and mentions, grouped into one unread entry per Table. No duplicate mention badge in the bell. Owner previously suggested an envelope as “maybe”; latest go-ahead authorises work but does not conclusively choose this split. Alternative offered: one bell.
2. Proposed read behavior: opening activity list does not clear it. Only activity actually shown in a visible Table/message/thread is acknowledged; newer, unloaded or background-tab activity stays unread. Removed membership/closed Table hides the entry. Alternative offered: explicit Mark as read only. Must settle this before implementing acknowledgment behavior.

## Source findings

- Existing follow notification trigger intentionally returns without an acceptance alert on pending→approved. The original table constraint admits only follow_request/new_follower; extending acceptance needs a considered additive candidate, current-read compatibility, role grants and erasure handling.
- Current bell combines mentions/follows/original-comment notifications and counts pending requests even if read. Current mention links acknowledge on click, before proving destination visibility. Grouped activity cannot be achieved by changing only the icon.
- Existing membership periods distinguish each join/rejoin. Activity must respect current membership, exclude the actor, avoid resurfacing a previous membership's unread state, and suppress closed/revoked destinations. Existing conversation/account revision signals can refresh badges without exposing content in Realtime.
- Timeline/reply/mention/member triggers and retries already exist. New capture must avoid duplicate message+mention alerts, role-change/add-member no-op alerts and duplicate retries. Mentions introduced by an edit need an explicit treatment; ordinary content edits should not produce a message alert for every member.
- Read acknowledgments must be recipient-bound and limited to the rendered activity/version, so an old page cannot clear newer activity. A single unbounded clear-all-on-open cursor would not satisfy the proposed read rule. Preserve existing per-thread ordering and loaded-window limits.
- Reuse guarded current sender/Table/source reads. Store only necessary notification metadata, not copies of Plate/Table bodies or image paths. Original Plate privacy remains independent of a Table share. Account erasure must scrub new sender/recipient/source links at the existing cutoff and remain compatible with replay.

## Implementation and verification order after decisions

1. Prepare additive candidate outside managed migrations, UI/helpers and rollback-only tests. No permanent installation or historical backfill implicitly authorised.
2. Test grouping, self-actions, duplicate retries, mention deduplication/edit cases, follow acceptance, read isolation/stale acknowledgment, source removal, membership removal/rejoin/closure and fixture-only erasure. Obtain specific approval for local test commands and rollback fixture scope once concrete.
3. Run approved source/build checks, then separately approved local candidate activation and installed-schema checks. Do not show working badges for an unavailable backend without readiness handling.
4. Browser acceptance across existing test accounts with exact authorised mutations. Keep owner account safe; preserve test records unless exact cleanup approved. No worker needed for text notifications.

Current app preview last confirmed running in session39824; photo worker stopped/drained. No pending operational command from this investigation. Batch 3 and 4 acceptance limits remain in their own documents.
