# QA Batch 7 — Visual and accessibility consistency

**Latest owner identity/title correction,18 October:** Display name/avatar enlarged18px/48px; @username/category back14px/unlinked. Category fallback Feed headings removed, existing short headings plain, muted left View plate below content/opposite date. Detail empty-body page heading neutral Plate. Final lint/types/build/scoped browser passed; preview84814. QA_VISUAL_FOLLOWUP.md holds exact evidence/limits. Earlier linked-heading/16px-username claims are historical.

**Header/metadata refinement, 18 October (latest):** Owner requested balanced header icon vertical spacing and less prominent Plate metadata. PageLayout icons vertically centred at sm+; shared Feed/detail author block shows avatar/name row then left-aligned @handle/category; short calendar date below content and above actions preserves full accessible timestamp. Final lint/types/build and desktop/phone detail/Firefox Feed checks passed. Measured27px above/below header controls. QA_VISUAL_FOLLOWUP.md holds proof/limits; latest preview3777. No data/schema/Git/remote changes.

**Owner visual follow-up, 18 October (latest):** Owner rejected the visual weight of equal full-width tabs, selected underlines and four-action Plate footer; approved researched compact treatment. Implemented compact filled navigation/three People views plus Received-Sent, creation below banner, Search management link below form, compact heart-comment-bookmark and linked Feed heading. Final lint/types/build and scoped desktop/phone/keyboard/browser checks passed. QA_VISUAL_FOLLOWUP.md records exact changes/evidence/limits. Preview53804 now running. Earlier equal-width/underlined selected-tab treatment below is historical and superseded; new visual acceptance is pending owner review. No DB/Git/data/remote changes.

## Final result — built and scoped browser checks passed, 18 October

Batch7 implemented locally and checked within the approved scope. Final `npm run lint`, `npm run typecheck` and `npm run build -- --webpack` all passed after the last application edit. Preview restarted at `http://127.0.0.1:3000`, execution session2550. Photo worker was not started or operated; earlier stopped/drained status was not independently rechecked.

Browser used the existing signed-in peer session. Passed desktop1280 and phone360/390 layout checks: equal-width/current-state tabs, Search query preservation, Menu query retention across saved/removed views, shared header/body left alignment, readable initials, saved-copy link and secondary unsaved Plate Save (44px), unpressed Like/active-comment labels, Account separate bio/privacy sections and styled chooser. No horizontal overflow on exercised pages. Tested Table title/header, member panel fit, keyboard Enter opening, Escape/trigger focus return and white3px dark-surface outline. Menu confirmation initially focuses Keep in Menu, Cancel preserves item, short360×320 viewport constrains dialog to288px with scrolling. Final Cancel and Escape restore opener focus with3px outline.

Browser exposed two implementation issues during iteration: class merging initially discarded avatar foreground; custom text-meta was replaced with known text-xs sizing. A minimum introduction height still shifted buttons; final grid reserves natural longest-step height with four inactive/inert/aria-hidden panels and one exposed step heading. All five steps retain identical document button position at360px (1005px) and390px (901px), without horizontal overflow; heading focus moves correctly. No Finish/Skip/completion mutation.

Browser also exposed state-opened confirmations returning focus to body. Shared AlertDialogContent now captures opener on opening and restores connected/enabled opener on closing, respecting callers' autofocus overrides. Final rebuilt Cancel/Escape checks passed. No existing guards or destructive action behavior changed.

Computed contrast for tested avatar initials and active-tab text:13.56:1. No captured in-app client errors. Final phone proof `/private/tmp/plates-qa-batch7-final-phone.jpg`; viewport reset and QA tab retained for review. Screenshot shows keyboard focus on account control. Account email/details were excluded from inspection output and screenshots.

No posting, new fixtures, saving/removing/liking, uploads, account/privacy/membership edits, sign-in changes or tour completion. Normal existing Table page read/receipt behavior remains active; no separate notification mutation command used. No database command/schema activation, worker start, dependencies, deletion, Git, remote or publishing action.

### Remaining limits and next work

This is scoped browser acceptance, not a complete accessibility certification or release rehearsal. Actual browser zoom/text enlargement, physical phones/mobile keyboards, full screen-reader testing, all long/localised content, every route/control, real liked-state toggle/processing/failure outcomes, Request save mutation and broader privacy/access races were not newly tested. Stable grid grows naturally instead of clipping at a fixed height; enlarged text still needs acceptance. Existing Account structure was retained because separate bio/privacy sections were confirmed. No new notification colour semantics introduced; butter remains unread/attention.

Next Batch8: integrated separate-account/fresh signup/privacy/access/failure rehearsal and fixture inventory without cleanup. Carry >50-message context and posting, >100 replies, browser follow-acceptance alerts, populated comment paging, slow/timeout/edited-mention/membership changes and earlier batch limits. Hosted email/worker/backup/restore/record adapter and managed migration integration follow separately; optional photo-set editing/Table-for-two remain out of scope.

## Implementation update — 18 October

Owner confirmed a non-default feature branch is active and approved local lint/types, preview stop/build/restart and scoped browser checks (menus/panels permitted; no posting/uploads/account/privacy changes/database commands). Earlier pending-approval checkpoint below is historical.

- Added shared ViewNavigation for Search, People and Menu: equal-width responsive grid, 44px minimum targets, explicit current page and underline plus colour. Search retains query across type changes; Menu retains query across saved/removed views. Manage your people is separate navigation.
- PageLayout now places headings and account controls within the same padded reading column as body content. Phone Table header puts account controls on a separate row, preserving title space.
- Avatar fallback has explicit dark foreground. Browser caught class-merging collision between custom text-meta and foreground; replaced fallback size with recognised text-xs so both size and colour survive.
- Plate/Request Save controls use shared secondary outlined Button styling and wrap long labels. Existing saved/removed/processing/backend semantics retained. Like retains aria-pressed and filled heart; persistent liked styling is distinct from unpressed hover.
- Shared dropdown uses available-viewport height/scrolling; confirmation dialog gets dynamic viewport height bound, scrolling and explicit foreground; sheet titles reserve close-button space. Existing Radix focus/keyboard behavior retained.
- Picture input chooser styled with the existing palette. Table unseen-message live announcement uses existing singular/plural helper. Account bio/privacy already have separate sections; source and browser verified rather than reorganised.
- Introduction uses overlapping grid panels to reserve the longest step's natural height; inactive panels invisible/aria-hidden/inert, only active heading receives focus. Replaced initial minimum-height approach after browser exposed residual button movement. No fixed clipping heights or completion changes.

Lint/typecheck passed after final source edit. Production rebuild and final browser acceptance in progress. Earlier successful builds and browser checks found header alignment/equal tabs/query preservation, 360px People/Menu/Table layouts, keyboard menu/panel open/Escape/focus return, dialog cancellation, 390px saved Plate and Account chooser/section headings. No save/remove/like/post/upload/privacy/tour-completion action performed.

## Initial review checkpoint (historical)

18 October 2026. Owner requested Batch 7. Read-only source review completed; implementation awaits the owner's confirmation that an appropriate non-default feature branch is active. No Git commands run. Local lint/typecheck, preview stop/build/restart and scoped browser-check approval was requested and remains pending.

## Scope and source findings

- Shared navigation tabs for Search, People and Menu, with visible/current-page states and stable sizing. Search's Your people destination should be separate from result-type navigation. Preserve search query when switching relevant views.
- PageLayout currently positions account controls against the full header while headings/body use a narrower reading column. Align shared header content and preserve phone wrapping.
- AvatarFallback sets a pale background without an explicit foreground, inheriting white text in dark headers. Give initials an explicit readable foreground.
- Plate and Request Save controls still use primary tomato styling. Use a consistent secondary action treatment while preserving saved/removed/processing distinctions and existing backend behavior.
- Like already has aria-pressed and a filled heart when liked. Strengthen persistent state styling so hover cannot be mistaken for liked state.
- Dropdowns lack a shared viewport scrolling constraint. Confirmation dialogs lack a viewport height limit; long content/zoom can make actions difficult to reach. Preserve existing Radix focus/keyboard safeguards.
- Review Account profile/privacy separation, upload-control presentation, singular/plural wording, standalone accessible names and phone Table header crowding. Introduction navigation currently moves with content height; improve stability without fixed clipping heights.
- Keep existing oat/tomato/aubergine design and butter yellow for unread/attention. No redesign, data/schema changes or optional features.

## Verification status

Only local documentation/source inspection performed. Installed Next accessibility and Server/Client Component guidance read. Attempted `01-app/02-guides/styling.md` read found no file at that path; locate the actual guide if further styling-specific guidance is needed.

No application edits, tests, browser actions, service changes, database commands, dependency changes, deletion, Git or remote actions performed. Prior preview session33743/worker-stopped status is historical, not freshly checked.

## Next steps

1. Receive owner feature-branch confirmation before application edits.
2. Implement focused shared-component fixes, then page-specific fixes; inspect any additional files first.
3. Receive requested concrete local-check/browser approval, explain exact commands, run relevant checks and production-build browser acceptance at desktop/360px/390px plus keyboard/zoom/focus return.
4. Update this record with actual changes/results/limits and carry untested cases into Batch 8. >50-message context/posting and browser follow acceptance remain separate carried-forward rehearsal checks.
