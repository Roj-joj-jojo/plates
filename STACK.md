# Plates — Stack and First Build

Agreed direction · updated 2026-10-06

## Stack

The owner chose a mobile-friendly website first and approved continuing with Next.js, TypeScript, Tailwind CSS, Supabase, and Vercel. SQL is the owner's strongest language; previous assisted work includes Python, Next.js and React, and previous hosting includes Vercel.

| Responsibility | Choice |
| --- | --- |
| Web interface and application server | Next.js with React and TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL through Supabase |
| Identity and media | Supabase Auth and Storage |
| Updates | Refetch on focus/pull-to-refresh initially; Realtime deferred to M7 |
| Schema changes | Readable, ordered SQL migrations; no additional ORM initially |
| Initial search | PostgreSQL text search and author lookup |
| Eventual web hosting | Vercel; no deployment authorised yet |

Keep business rules explicit: Supabase supplies infrastructure, not the app's membership, snapshot, source attribution or removal policy. Database grants and row-level policies, private media access, and live-update authorisation need tests with different users.

## Costs and local development

Keep initial costs as low as practical. Develop locally before creating hosted projects. Hosted Supabase Free is the proposed starting tier; resize/limit uploaded images. Vercel Hobby is suitable only if its personal, non-commercial conditions are met; verify eligibility before publication. Paid subscriptions, new accounts, uploads and deployments require separate owner action/authorisation.

Pricing checked on 2026-10-04: Supabase Free includes a 500 MB database and 1 GB file storage, with inactivity pausing; Pro starts at USD 25/month. Vercel Pro starts at USD 20/month, with applicable usage charges additional. These are planning figures, not a commitment or spending cap. Sources: [Supabase pricing](https://supabase.com/pricing), [Vercel pricing](https://vercel.com/pricing), [Hobby conditions](https://vercel.com/docs/plans/hobby).

The owner installed Node.js 24.21.0 and npm 11.19.0 and completed package installation, clean lint, TypeScript checks and the Next.js build. Production-only audit reported zero vulnerabilities. The owner confirmed local preview/navigation worked on 2026-10-04 and reconfirmed it on 2026-10-05; the interrupted final handover has now been reconciled. See `README.md` for the unresolved development-tooling advisory, ESLint support and install-script warnings. A local Supabase stack may require additional CLI/container tooling; that setup is not implicitly authorised by selecting Supabase.

## First build sequence

1. Branch, runtime and package prerequisites are satisfied. Owner confirmed `prototype-foundation`, Node.js 24.21.0 and npm 11.19.0; lint, typecheck and build passed. Agents must not invoke Git.
2. Local email-code sign-in, Account protection and sign-out passed browser verification on October 8. A repeatable local Auth/HTTP smoke test passes. Feed, Tables and Menu now have a connected text/link first pass.
3. D1–D9 are recorded in [DATA_MODEL.md](DATA_MODEL.md). Local setup is complete; owner confirms PostgreSQL 17.11 and loopback ports. M1/M2/M3 suites and M1/M2 regression against M3 passed, with fixtures rolled back. Populated-data HTTP and concurrency tests remain separate work; see [the database instructions](supabase/README.md).
4. The connected browser loop passed: publish Plate → share to one Table → reply → save → reopen original or exact discussion. Author editing, `Edited since shared` and frozen Menu copy also passed. Populated HTTP denied private Table access to a non-member; same-session concurrent retries for share/reply/save returned one record each. Verify access with two members and different-session races once invitations and their pre-invitation prerequisites exist. The screens passed lint, typecheck and a Webpack production build; default Turbopack build hit a local worker port restriction.
5. Formal Table Requests and live-discussion Menu saves are locally implemented and owner-confirmed in the browser. Initial literal keyword search across accessible Plates, one chosen Table and Menu saves is also locally implemented; SQL, real Auth/HTTP privacy checks and rendered pages passed. Table image browsing awaits the agreed private media upload/delivery pipeline. This first loop alone is not the entire MVP.

Remaining wireframes and additional research responses do not block starting the first loop. Refine interfaces through the working app. No arbitrary message saving, native application, private author profiles, or external search service is required for this foundation.

## Pending setup permissions

- Active non-main branch: owner confirmed `prototype-foundation` after running `git switch -c` themselves and reconfirmed it on 2026-10-05. No agent-executed Git commands.
- Local runtime setup completed by owner on 2026-10-06: Docker on Apple silicon, project-local Supabase CLI pinned at 2.120.0, successful initialisation/startup and PostgreSQL 17.11. Docker's bundled executable reports 29.8.2; use `/Applications/Docker.app/Contents/Resources/bin/docker` if plain `docker` is unavailable. Supersedes the initial missing-tool probes in the historical handover.
- Package manifest uses Next.js/ESLint config 16.3.8, React 19, TypeScript 5, Tailwind 4/PostCSS, ESLint 9, and Supabase clients. A generated lockfile now exists. ESLint 9 support and the unpatched transitive `braces` advisory require follow-up; forcing ESLint 10 conflicts with three installed plugins' declared peer ranges. No upgrade or override was made.
- Hosted projects, credentials, email delivery, deployments and billing: not configured or authorised. Do not ask the owner to paste secrets into chat.

## Local database setup and login

Completed 2026-10-06: owner installed Supabase CLI 2.120.0, ran init/start and reported PostgreSQL 17.11. Local Studio is http://127.0.0.1:54323; the email viewer is http://127.0.0.1:54324. M1/M2/M3 are applied and SQL-tested; local Auth sign-in and sign-out passed browser verification on October 8. The new Plate loop awaits browser verification. Dashboard login through GitHub has not linked this project to hosted Supabase; no hosted action is authorised.

**Working network configuration:** retain the plates-local Docker bridge with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`, and Docker Desktop Settings → Resources → Network → Port binding behavior → Localhost by default. The bridge setting alone did not restrict ports in this environment. After changing the Desktop default and recreating containers, owner output confirmed that ports 54321, 54322, 54323, 54324 and 54327 bind only to 127.0.0.1 and ::1. Bare internal container ports are not host publications. No independent cross-device reachability test was performed. Desktop's default affects new containers across the Mac.

Run future starts from `/Users/roryjohnson/dev/plates` using `./node_modules/.bin/supabase start --network-id plates-local`. Stop with `./node_modules/.bin/supabase stop` without destructive flags to retain data. Review output after each operation; do not paste credentials. Recheck actual port bindings after network/runtime changes rather than trusting displayed localhost URLs. See the [Supabase setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started) and [Docker Desktop networking](https://docs.docker.com/desktop/features/networking/).

Passwordless email was selected; use one-time codes as the initial implementation default, with the matching email template and verification flow tested locally. Collect the display name on signup and validate client-controlled metadata in a small Auth-insert trigger that atomically creates the app profile and private Auth link. Test failed signup rollback. Custom SMTP is required before invitations beyond local testing; no provider/account is selected or authorised. Apple/Google login remains deferred. See [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
