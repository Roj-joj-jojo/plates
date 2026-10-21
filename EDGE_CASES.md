# Local edge-case acceptance

2026-10-11. Owner specifically approved the prepared fixture scope and three commands. Script syntax, focused ESLint and the real local acceptance run all exited zero. No application fix was required.

## Results

| Check | Observed result |
|---|---|
| Two Admins demote themselves, demote each other, or leave concurrently | One action succeeds and the competing action is refused; an Admin remains. |
| Last Admin appoints a replacement while that member leaves | One action succeeds; an active Admin remains. |
| Last Admin closes while another member is added | The tested outcome meets the invariant: either closure ends access, or the changed membership requires fresh review with an Admin still present. |
| Author edits while Admin removes the same version | One action succeeds; conflict/permission checks refuse the competing stale action without restoring removed text. |
| Request withdrawal competes with a new reply | Withdrawal succeeds; a concurrent reply is either retained if accepted first or refused. Earlier replies remain available with a working notification destination. |
| Mention older than the newest 50 entries | Authenticated Table HTML contains the older target when requested; notification HTML links to its Table anchor. After removal the target shows unavailable, its notification disappears, and outsider HTML reveals no fixture conversation. |
| Table photo removal | Initial signed delivery succeeds; removal hides its location and denies a new signed URL. The previously issued three-second URL is refused after expiry. |
| Plate edit/unpublish, snapshots and photo delivery | Stale unpublish is refused; competing same-revision edit/unpublish yields one winner. Unpublished photo locations/new signing are denied and the old short URL expires. A saved text Menu snapshot and the share discussion context remain. |

## Retained scope

Private manifest: `/private/tmp/plates-edge-cases-Qzp51R/scope.json`.
Private result journal: `/private/tmp/plates-edge-cases-Qzp51R/results.jsonl`.

The run reused the three existing disposable social-test accounts in isolated local sessions, without sending email or altering the owner's browser cookies. Membership and content mutations affected only the four new labelled Tables and newly created contributions. All records and both tiny WebP objects remain; no cleanup permission is implied.

| Fixture Table | ID |
|---|---|
| Edge Admin races 0b14b44a | fe171b02-35d2-4dc1-b871-ebef4466e572 |
| Edge Replacement race 0b14b44a | 2514c1a6-fa15-4462-abc5-b46ddbedccd7 |
| Edge Closure race 0b14b44a | 273d155f-cff7-4e81-8b53-3907f1b2c224 |
| Edge Content edges 0b14b44a | 565b4220-f6a4-4791-be67-910ddd844563 |

Retained objects: Table media `565b4220-f6a4-4791-be67-910ddd844563/6e21cc07-e31b-4c54-8d47-a8a6510678a9.webp`; Plate media `65e5e4f3-600d-430f-874f-74c5dbf7e253.webp`. Originals are ordinarily removed/unpublished; objects are retained under that policy. No Auth deletion, erasure request/log, preview/decoder worker, schema change, dependency, Git or hosted action occurred.

## Limits and next step

These are real local API/concurrency/Storage and authenticated server-render tests. They do not simulate every transaction ordering, act as a stress test, or prove interactive browser scrolling/menu/confirmation behavior. General browser acceptance was previously owner-reported; design changes will need browser review again.

The URL test waits for an actual short-lived token to expire. It does not wait the full one-hour duration currently used by app photo links. Ordinary removal does not immediately revoke existing signed links or cached/downloaded images; new signing is denied. Stronger physical erasure remains the separate account-erasure process.

A fresh production build and hosted verification remain outstanding. Reload/reconnect draft recovery is still deliberately deferred. Next product stage is design, including less prominent message options, followed by hosting/release preparation.

The test runner refuses a second mutation run against this manifest. Future tests must review retained state and prepare a new explicitly approved scope, rather than deleting or silently duplicating fixtures.
