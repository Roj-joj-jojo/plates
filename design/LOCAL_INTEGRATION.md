# Local Table design integration — 2026-10-12

## Implemented locally

- V3 Oat, Tomato and Aubergine theme (updated 2026-10-13) and Bricolage Grotesque/Manrope fonts; supplied variable font files and SIL licences are bundled under src/app/font-assets. Fonts use next/font/local. The preferred black Table header is retained.
- Shadcn-style Radix primitives (Button, Textarea, Avatar, DropdownMenu, AlertDialog and Sheet) and components.json; approved UI dependencies installed.
- Table root screen: chronological conversation, compact author/Admin menus, edit panels and removal confirmations, fixed visible-viewport shell, desktop navigation/member/photo panels, mobile navigation, bottom composer and unread/jump-to-latest feedback.
- Existing message/photo-only upload, same-payload retry IDs and prepared attachment IDs retained. Mention suggestions still exclude self and now support keyboard selection/dismissal and a synchronous submission lock.
- Existing Table access, edit collision checks, author/Admin permissions, retained discussions, unavailable mentions and server Menu-save/photo preview paths retained. Shared Plate previews reuse the existing SavePlateButton.
- Compact photo grid preserves the current viewer for all photos. No schema, test fixture, hosted or Git changes.

## Checks actually run

- npm run lint: passed.
- npm run typecheck: passed.
- npm run build -- --webpack: passed on final source with locally bundled fonts.
- Integrated use-thread-scroll source passed seven synthetic scroll scenarios (mixed history/live batch, resize, repeated/missing navigation, disjoint history/live arrivals, bottom following, reduced motion/cleanup). Reference package composer checks also passed; these do not verify the integrated upload form.
- Restricted package install stalled and was stopped; approved network retry installed successfully. Initial restricted Google-font build failed; network retry passed, then supplied local fonts removed that dependency and final restricted build passed.
- Installer reported five high-severity audit entries and the existing unrs-resolver install-script warning. No forced fixes/upgrades or script approvals were made; audit-chain attribution was not rechecked here.

## Owner browser acceptance next

Owner chose to start the preview. From /Users/roryjohnson/dev/plates, run npm run start after ensuring the existing local backend is available. This starts loopback-only HTTP at http://127.0.0.1:3000; Ctrl+C stops it. Do not run dev/build concurrently against the same .next folder.

1. Open an existing Table at desktop and a narrow/mobile window; check fonts, navigation, composer and long names/text.
2. Use separately approved disposable contributions for posting/photo-only/retry and author/Admin menus, edit cancellation/conflict and removal confirmations. Do not remove existing content without exact target approval.
3. Two accounts: incoming message with draft and while reading above the bottom; draft/focus and reading position must remain.
4. Open available and unavailable mention targets, including another target in the same Table.
5. Verify Plate/Menu save/discussion behaviour, all-photo viewer and retained replies.
6. Real iPhone Safari/Android Chrome keyboard: one/six-line draft, mention list, rotation and incoming update. Not verified by desktop build/synthetic tests.

No app server was started by the agent. Firefox read-only navigation found no server at 127.0.0.1:3000, so no authenticated Table, browser mutation, real upload/removal or physical-device checks were performed. Non-Table content remains its prior layout; common fonts/navigation now use the theme. Hosting is still separate work.

## V3 palette update — 2026-10-13

Merged the supplied v3 colours into the existing theme, preserving layout, local fonts, radii, accessibility and live-update code. Oat page/nav/composer, lifted cream cards/inputs/panels, aubergine links/mentions, tomato primary actions and black Table header. Remaining legacy green literal classes across secondary routes/forms now use theme tokens. No dependencies installed.

Lint/typecheck passed; in-memory Tailwind compilation generated the app utilities. Checked contrast: body/oat 16.03, muted/oat 7.52, links/oat 14.33, links/tint 12.12, white/tomato button 5.67, white/black header 18.74 and input border/oat 7.52. No full production rebuild or browser/device verification in this update. Prior production-build success above refers to 2026-10-12 source. Rebuild/restart an npm run start preview before visual review.

## Shared app frame — 2026-10-13

PageLayout now provides black headers with white focus treatment, descriptions/actions/back links and centred content. AppFrame uses a 200px desktop rail and safe-area mobile bottom navigation. Six main destinations and related detail/management screens use this layout; Table conversation keeps its independent shell and right panel. Feed Add a Plate is in the header. Prototype copy replaced with product guidance.

Lint/typecheck and in-memory Tailwind compilation passed. Static structural checks passed; attempted synthetic SSR was blocked by the agent runtime before rendering. No fresh production build or browser/device review. Rebuild/restart the owner preview and review main routes, narrow screens, back links and discussion/mention anchors.
