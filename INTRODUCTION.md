# First-run introduction

Updated 2026-10-15. Owner approved implementation and separate local activation of the five-step introduction with Skip, account-persistent completion and replay from Account. Candidate `20261015000500_introduction.sql` **is installed locally** and remains outside managed migrations. Preflight, installation and installed-schema rollback checks passed. Browser acceptance is next; app/worker last confirmed stopped/drained and not restarted by the agent.

## Behaviour

- The next Feed visit redirects an account with no saved choice to `/introduction`, once the backend candidate is installed. Existing accounts see it too. Direct links to other content are preserved; the walkthrough is not an access gate.
- Five steps explain Feed, Plates, Tables, Menu and People. Small, labelled example previews create no actual content or account interactions. Privacy, comment audience, Table membership and retained Menu copies are explained.
- Back and Next move through steps; the new heading receives keyboard focus. Progress, ordinary keyboard controls, responsive layout and existing minimum touch targets are retained. It is a page, not a modal, so Escape has no dismissal behaviour.
- Skip and Finish both save the same account-level dismissal and open Feed. Last-step shortcuts save that choice before opening Find people, Create a Table or Add a Plate. A failed save shows a retry message; navigation remains available. Merely leaving through navigation does not save completion.
- Account → Replay introduction always opens step one, even after completion. Replay never resets or rewrites the saved choice. No browser-local flag or completion analytics; a fresh session/device reads the same account setting. Refreshing mid-tour restarts at step one.
- No installation means no automatic redirect/replay entry; a direct introduction URL shows an unavailable message with a Feed link.

## Storage and erasure

One private RLS table stores a random row ID, unique profile reference and dismissal timestamp. No direct client/service-role table privileges. Authenticated-only RPCs read/complete only the current active account, without accepting another account ID. Completion is idempotent and locks the profile before writing, serializing with account cutoff. A profile-state hook clears the identity/timestamp at recorded-erasure cutoff or final erasure; ordinary temporary disable preserves the choice and denies reads/writes. Replay/restore must run existing erasure replay before admission; this hook covers profile-state replay, not independent backup signing or physical retention operations.

## Verification

Owner approved source checks and confirmed app/worker stopped/drained before database checks/build. Lint, TypeScript and runner syntax passed. The rollback database test passed after a first fixture failure exposed the disabled-state erasure cutoff; the hook was corrected, and the full test passed. Docker access required approved escalation after sandbox refusal. Final lint, runner syntax and production build passed; build compiled, typechecked, generated routes and completed tracing. No source changes after those passing checks.

```sh
node scripts/test-introduction.mjs
```

The test temporarily installs only this candidate, creates two synthetic Auth/profile accounts, temporarily disables admission within the transaction, and tests initial status, completion, retries, independent account/session state, anonymous/service/direct-table restrictions, temporary disable/reactivation, and fixture-only recorded-erasure identity/timestamp clearing. Uses a structurally valid synthetic receipt, not independent signing. All candidate, fixture and setting changes roll back. No content, Storage, photo jobs, Auth deletion or cleanup. No true simultaneous transaction/browser/accessibility verification yet.

## Local activation — approved and completed

Owner separately approved these commands on 2026-10-15. Read-only absence/prerequisite/photo-work preflight passed, installation committed, and installed-schema fixture checks passed. These commands are an execution record; do not repeat the absence preflight or reinstall the candidate.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/diagnostics/20261015_introduction_preflight.sql
```

After preflight passed, installed this single candidate:

```sh
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_plates psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/candidates/20261015000500_introduction.sql
```

Verified the installed schema with the same rollback-only fixtures; all test accounts, preference records, cutoff and admission-setting changes rolled back:

```sh
node scripts/test-introduction.mjs --applied
```

No existing completion backfill or content changes. Do not reinstall other candidates or push all migrations. The owner must later integrate the candidate into the migration/release process for fresh environments.

Initial preflight sandbox attempt could not access Docker; the exact command passed with approved escalation. Installation and installed tests also used approved Docker access. No real account choice was set during activation, and no app/worker restart, source changes, Git, dependency, physical deletion, hosted access or publishing occurred.

## Browser acceptance after activation

2026-10-15: owner reports “yes to all, looks great” for first Feed introduction/Back/Next, Skip or Finish with refresh persistence, Account replay, final shortcuts, narrow layout/keyboard controls and a separate introduction for a second account. This records owner-reported checklist acceptance and visual approval. Save-error handling, fresh sign-in/cross-device persistence and true concurrency were not independently verified. Earlier browser-pending wording is superseded for this checklist.

Owner starts the built app with `npm run start`; no photo worker needed. Check first Feed visit, all five steps, Back/Next, labelled synthetic previews, Skip and Finish, refresh/new sign-in persistence, account isolation in a second session, Account replay and final destination shortcuts. Check narrow mobile width, keyboard focus after step changes, tab order and busy/error handling. No real account erasure for acceptance. Broader alpha acceptance remains separate.
