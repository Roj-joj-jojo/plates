# Plates

Mobile-friendly food sharing with private Tables and a personal Menu.

## Current implementation

**2026-10-14 status update:** The implementation paragraphs below retain older milestones and are partly superseded. Photos, admission/owner account management, Table Admin/member controls, mentions/live updates, content controls, pictures and open/private following are now implemented locally. Feed uses own Plates plus approved followed authors. Likes/simple direct comments and new-comment notifications to the Plate author are agreed alpha work but unbuilt; first-run introduction, complete release acceptance and hosted preparation remain outstanding. See [alpha release plan](ALPHA_RELEASE_PLAN.md), [social implementation](SOCIAL_ALPHA_PLAN.md) and the latest dated [handover](HANDOVER.md) entries. No deployment has occurred.

The Next.js app now has a connected text/link loop: sign in, publish a Plate, create a Table, share the Plate, reply in its discussion, and save it to Menu with a link back to that discussion. Formal Table Requests and literal keyword search across accessible Plates, one chosen Table, and saved Menu items are also available locally. Feed currently lists recent accessible Plates while following is still unimplemented. Images, invitations, lifecycle controls and other MVP work remain open. This is not ready to publish or accept real users.

Supabase browser and server helpers back sign-in and the connected pages. A session-refresh Proxy covers Account, Feed, Tables and Menu; each connected page verifies the user with local Auth. Local browser sign-in/sign-out, the full one-account Plate loop and author-only editing passed on October 8. A populated HTTP test with two synthetic accounts confirmed the non-member could read the Plate but not its private Table, discussion or someone else's Menu. Same-session concurrent share, reply and save retries produced one record each. Second-member and different-session concurrency remain untested.

M2 SQL for text/link Plates, Table messages and replies was applied locally on October 6. M3 text/link Menu reminders were applied locally on October 7. The owner supplied final PASS markers for all three SQL suites and for M1/M2 regression against M3; all fixtures rolled back. See [local database instructions](supabase/README.md) for scope and limitations. Media remains later work.

## Local setup

Run each command from `/Users/roryjohnson/dev/plates`. Node.js 24 LTS and npm are required; the owner has confirmed Node 24.21.0 and npm 11.19.0.

First install the packages declared in `package.json`:

```sh
npm install
```

This downloads dependencies, can execute dependency install scripts, creates `node_modules`, and generates `package-lock.json`. It does not deploy the app or create a Supabase project. The lockfile records the resolved versions and should be retained. No `create-next-app` or Git initialisation step is needed.

After installation succeeds, run:

```sh
npm run dev
```

Open `http://127.0.0.1:3000`. The server binds to this computer only, and Ctrl+C stops it. `/` redirects to `/feed`; sign in before using Feed, Tables or Menu.

## Verification after installation

```sh
npm run lint
```

```sh
npm run typecheck
```

```sh
npm run build
```

Lint checks source conventions, typecheck generates Next.js route types and checks TypeScript, and build checks compilation. These commands may generate local Next.js/type-cache files. On 2026-10-08 the connected screens passed lint and typecheck. The default Turbopack build failed when its CSS worker could not bind a local port, including on an approved retry; `./node_modules/.bin/next build --webpack` passed and generated all connected routes. The owner then passed the full one-account browser loop. The owner's production-only audit reported zero vulnerabilities on October 4; the development-only findings below remain unresolved.

### Installation findings (2026-10-04)

The owner's audit reported five high-severity entries from one development-only chain: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched release. The installed plugin uses glob patterns from lint configuration's `settings.next.rootDir`; this app's config does not set that option. This narrows the identified local exposure but does not remediate the dependency or certify the full app.

Do not blindly apply the suggested forced downgrade to Next.js lint config 14.2.35. ESLint 9 is separately out of support; installed import, React and accessibility plugins do not declare ESLint 10 support. Review a compatible toolchain update before release, without disabling checks or forcing peer dependencies. The current recommendation is to continue trusted local verification while recording the unresolved tooling findings.

Completed diagnostic (2026-10-04): the owner ran `npm audit --omit=dev` and reported zero production-dependency vulnerabilities. This command reports known advisories without changing installed files; it sends dependency information to npm's registry. This is not a complete security test. The `unrs-resolver` install-script warning also remains unresolved; do not blanket-approve install scripts. No dependency upgrade, override, suppression or install-script approval has been performed.

## Later Supabase connection

`.env.example` names the two public configuration values. For local sign-in, ignored `.env.local` now exists in the project root with the local Supabase URL and an owner-saved Publishable key. The agent has not read the key. Keep key values out of chat and never put secret/service-role keys in browser-visible variables. Do not create a cloud project, apply migrations remotely, or deploy without the owner's explicit instruction.

The local Auth email templates contain a six-digit code. The owner reconfirmed that local Supabase ports bind only to loopback. In the browser, `/signin` has separate create-account (requires display name) and existing-account paths. The local email viewer at `http://127.0.0.1:54324` receives the code; `/account` checks the session with Auth and offers sign-out. Browser sign-in, sign-out and post-sign-out Account protection were confirmed on October 8. A local test account persists after testing; no cleanup or erasure operation is implemented. Restart local Supabase and Next.js after they have been stopped before checking the new Plate loop.

The local migrations through Plate images, the photo Menu-save guard and per-account upload limits are applied. Their rollback-only SQL suites passed, as did local Auth/HTTP Request, search, photo and upload-limit flows. Tables now have a plain-text message composer alongside Requests and shared Plates; members see messages in Table activity and Table search. New messages from other members appear after a page refresh until Realtime is implemented. Plate photos open in an in-page viewer with close, next/previous and dark-area click-to-close controls; the Table image gallery keeps a separate discussion link. The owner confirmed the viewer interaction works in the browser. See [local database instructions](supabase/README.md) for scope, preconditions and commands. M1 covers profiles/private Auth links, Table creation, memberships, periods, read policies and consistency checks. Invitations and lifecycle endpoints remain later work. Plate snapshots and Request-discussion saves are separate behaviours; see [the data model](DATA_MODEL.md), [private image plan](MEDIA_IMPLEMENTATION_PLAN.md), [product model](PRODUCT_MODEL.md) and [stack/build plan](STACK.md).
