# Plates theme v2.2

Revised reference package: [plates-theme-v2.2.zip](./plates-theme-v2.2.zip). Not installed into the app.

# v2.2 verification — 2026-10-12

Nine focused synthetic hook/event scenarios passed:

- Pending send blocks stale mention clicks, keyboard insertion, field changes and duplicate submits
- Failed send retains text/ID; text or attachment changes use a new ID; success clears text
- Combined prepend/live append keeps the visible message offset and counts only the arrival
- Composer resize preserves a reader's anchor
- Same-Table and repeated-target navigation works; a missing target completes after loading
- Disjoint history window does not invent live arrivals
- Disjoint live replacement counts only explicitly supplied arrivals
- A reader at the bottom follows a new arrival
- Reduced-motion jump is immediate and native anchoring is restored on cleanup

All 11 TS/TSX files passed in-memory syntax transpilation. Tests exercise supplied source with mocked React lifecycle, DOM geometry and RPC callbacks; no real browser or server is involved. This does not verify real React scheduling, browser scroll timing, CSS compilation, module resolution, a full app typecheck/build, accessibility or physical-device keyboard handling. Server idempotency was confirmed by reading existing project source, not a new database run.

The focused-checks.cjs script is included for reuse after unpacking the package into an approved development environment with TypeScript available. No dependencies were installed for these checks.

See the archive’s INTEGRATION.md for the existing post_message retry mapping and scroll/navigation API.
