# Owner decisions on QA follow-up — 20 October 2026

## Current scope

**Implementation update, 20 October 2026:** The owner subsequently authorised the agreed changes. Plate mentions remain unchanged for alpha, the first Back is hidden with space retained, and photo is the consistent visible term. Read `QA_FOLLOWUP_IMPLEMENTATION_2026_10_20.md` for changes, actual verification and remaining diagnostic limits; the decision-session account below is historical.

Read owner's inline responses in Downloads/QA_FOLLOWUP_REVIEW_2026_10_18.md and checked against project review/handover/current relevant source. This is the decision record; earlier 18 October recommendations remain historical. Preserve the annotated Downloads file and original review. Two chat clarifications confirmed: keep Table question → saved Request; date dividers Today/short older date, individual message time retained.

No application changes, runtime tests, browser actions, service operations, auth/data mutations, DB commands, Git, dependency/deletion or project uploads performed for this decision-record session. Public official product documentation checked only for requested sorting guidance; no project content sent. Prior preview/session status is historical and not rechecked.

## Headline findings

| ID | Owner decision | Next action |
| --- | --- | --- |
| F1 Table addition/history | No change while recipients can leave. Private-account acceptance could be considered later. | Preserve immediate membership/full history and existing leave/Admin rules. Optional future consent is backlog, not alpha work. |
| F2 earlier-session identity | Owner unable to reproduce; likely browser-related. | No speculative cache/autofill fix. Keep as unconfirmed observation; normal sign-out/in and isolation remain in release rehearsal, reopen on concrete evidence. |
| F3 implicit OTP send | Owner explains tester typed over the owner's manual sign-in/verification; regards it as testing interference. No action required. | Close as owner-explained testing mix-up, not a confirmed application bug. No extra OTP send or autofill change. |
| F4 hydration418/prefetch503 | Testing required; owner agrees with diagnosis plan. | Stable-build reproduction with detailed render/server evidence; distinguish service interruption/prefetch error from mismatch, avoid speculative client-only rewrite. |
| F5 toast overlap | Owner cannot reproduce; fix if reproduced. | Reproduce overlap/hit testing first; change placement/pointer handling only for established failure while preserving announcement/Dismiss. |
| F6 request volume | Backend testing required. | Plan bounded per-endpoint/per-tab request measurement and subscription/refresh/reconnect review. No permission inferred to run arbitrary DB commands or mutation suites. |

## Minor findings

| ID | Owner decision | Scope |
| --- | --- | --- |
| M1 empty edit | Test to determine correct validation instances. | Check text, links and existing photo combinations before proposing validation; photo/link-only edits remain allowed where backend supports them. |
| M2 last Admin | Agrees explanation needed. | Visible/accessible copy: appoint another Admin before removing own Admin rights; close/leave flow stays separate and uses existing guards. Do not imply demotion automatically closes a Table. |
| M3 accessibility labels | Defer this further audit/enhancement until after alpha. | Keep existing labels/focus/accessibility behaviour. No new broad accessibility audit in this follow-up batch. |
| M4 Table URLs | Clickable links required. | Implement safe HTTP(S) linkification for plain URLs in Table messages/replies without turning arbitrary text into unsafe links; preserve mentions, escaped text and external-link safety. Confirm scope before changing original Plate body rendering too. |
| M5 Plate mentions | Conversation required. | Hold changes pending tagging scope, eligibility, linking and notification decision. |
| M6 keyboard submit | Messaging Enter-to-send; other submission via button or Cmd+Enter. | Retain chat Enter/Shift+Enter/IME and mention selection behaviour. Add consistent Cmd+Enter for agreed multiline compose/edit forms (Ctrl equivalent sensible for non-Mac); ordinary Enter inserts a line there. Exact form inventory/Windows equivalent should be stated before implementation; no implicit request to disable normal keyboard activation of buttons or single-line sign-in forms. |
| M7 tour Back | Conversation required. | Uploaded table row was split by unescaped pipe in original JSX example. Recovered original assessment: first-step Back already disabled by busy OR index=0. Discuss visible-disabled versus hidden, or reproduce actual click; no fix assumed. |
| M8 tour structure | Concept-led acceptable; navigation tour only if alpha feedback warrants it. | Keep existing concept-led tour; future nav walkthrough backlog. |
| M9 Account location | Agree, implement. | Say Account/settings are under avatar menu; preserve tour replay destination. |
| M10 photo reply count | Owner suspects worker-off posting attempt followed by worker startup. | Record hypothesis, not root cause. Include delayed worker/timeout/retry visibility in scoped rehearsal; no count change based on guess. |
| M11 sorting | Check reference products; if no universal rule, keep with clearer copy. | Research below supports context-dependent ordering; recommend retain comments newest-first and Table replies oldest-first, consistently label each. |

## Copy approvals and holds

Approved direction, implementation pending:

- Keep Table question → saved Request model (explicit chat confirmation). Improve stray confusing terms without global rename.
- Consistent Add/Publish labels, while sharing an existing Plate to a Table remains a distinct action.
- Contextual edit titles for message/reply/share/question.
- Consistent field names and accurate optional labels based on valid text/link/photo combinations.
- One consistent People-management label; Deselect or Remove from selection distinct from member removal; neutral username example.
- Conversation day dividers: Today for current London calendar date, e.g.18 Oct2026 for older dates; individual messages retain HH:mm. Full accessible timestamp/timezone retained. Explicit chat confirmation. Test server/client consistency, midnight, DST and tab resume when implementing; no implication that every unrelated page's date becomes Today.
- Consistent removed placeholders, meaningful confirmation outcomes and editorial voice/punctuation. Do not force unrelated destructive actions into one generic label.
- Simpler tour language; keep frozen-copy, access and erasure meaning; correct stale bell/envelope mention description and immediate-add versus invitation wording.
- Shorter consistent saved/update notices; clearer adding-a-discussion-source wording; Menu results for…; Add a comment on original detail with separate audience text; active-voice open-account explanation.

Photo/picture/file terminology remains a conversation item. Confirm whether owner wants attached photos and profile/Table pictures distinguished before changing labels.

## Sorting research — official documentation

- Reddit community settings explicitly let communities choose default comment sorting for their purpose: https://support.reddithelp.com/hc/en-us/articles/15484546290068-Community-settings . Reddit's documented comment-tree API supports multiple orders including new and old: https://www.reddit.com/dev/api/ .
- Microsoft's Teams channel announcement guide explicitly supports See new posts at top and See new posts at bottom: https://support.microsoft.com/en-au/teams/teams-channels/send-an-announcement-to-a-channel-in-microsoft-teams . This is channel-post ordering, not a claim that all chat/thread types share those options.
- Discord's search guide distinguishes Newest and Oldest result orders: https://support.discord.com/hc/en-us/articles/115000468588-How-to-Use-Search-on-Discord . Search-result order does not establish live chat/thread order.

Inference: these references provide no single mandatory chronological direction across product contexts. They support retaining Plates' existing context-specific order with clear labels, not claiming any reference product implements our exact design. No new sorting preference/UI/backend change proposed.

## Work order

1. Resolve remaining conversations: Plate mentions, first-step Back, photo/picture terminology. Keyboard scope/form inventory should be explicit before coding.
2. Prepare concrete stable-build test scope for F4/F6, conditional F5 and M1/worker-delay cases; retain release access/isolation checks. Get any required command/fixture/auth mutation permissions separately, consistent with AGENTS.
3. Implement agreed URL/keyboard and small copy improvements in reviewable batches, respecting feature-branch requirements. Timestamp changes need deterministic server/client initial rendering and midnight refresh checks so they do not introduce another hydration problem.
4. Finish outstanding Batch8 direct-access/failure/large-history checks before hosted preparation. Test fixture cleanup remains separately unauthorised; no account, invite, follow, Table or Plate removal.
