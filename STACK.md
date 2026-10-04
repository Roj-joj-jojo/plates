# Plates — Stack and First Build

Agreed direction · 2026-10-04

## Stack

The owner chose a mobile-friendly website first and approved continuing with Next.js, TypeScript, Tailwind CSS, Supabase, and Vercel. SQL is the owner's strongest language; previous assisted work includes Python, Next.js and React, and previous hosting includes Vercel.

| Responsibility | Choice |
| --- | --- |
| Web interface and application server | Next.js with React and TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL through Supabase |
| Identity, media and live updates | Supabase Auth, Storage and Realtime |
| Schema changes | Readable, ordered SQL migrations; no additional ORM initially |
| Initial search | PostgreSQL text search and author lookup |
| Eventual web hosting | Vercel; no deployment authorised yet |

Keep business rules explicit: Supabase supplies infrastructure, not the app's membership, snapshot, source attribution or removal policy. Database grants and row-level policies, private media access, and live-update authorisation need tests with different users.

## Costs and local development

Keep initial costs as low as practical. Develop locally before creating hosted projects. Hosted Supabase Free is the proposed starting tier; resize/limit uploaded images. Vercel Hobby is suitable only if its personal, non-commercial conditions are met; verify eligibility before publication. Paid subscriptions, new accounts, uploads and deployments require separate owner action/authorisation.

Pricing checked on 2026-10-04: Supabase Free includes a 500 MB database and 1 GB file storage, with inactivity pausing; Pro starts at USD 25/month. Vercel Pro starts at USD 20/month, with applicable usage charges additional. These are planning figures, not a commitment or spending cap. Sources: [Supabase pricing](https://supabase.com/pricing), [Vercel pricing](https://vercel.com/pricing), [Hobby conditions](https://vercel.com/docs/plans/hobby).

The inspected shell has neither `node` nor `npm` on PATH. The user may have a runtime in another terminal environment; confirm before installing or changing it. No packages or runtime have been installed in this session. A local Supabase stack may require additional CLI/container tooling; that setup is not implicitly authorised by selecting Supabase.

## First build sequence

1. Confirm the owner's active non-main feature branch and permission for local dependency installation/verification commands. Resolve Node/npm availability. Agents must not invoke Git, including through scaffolding tools.
2. Scaffold the app locally, preserving all existing documents. Start Feed, Tables and Menu navigation with clearly separated sample data while the database connection is unconfigured. Do not present simulated data as real shared persistence or bypass authentication for connected data.
3. Implement the initial SQL schema and membership policies for people, groups, Plates, timeline entries, threads/replies, and Plate saves with source references. Treat integrity constraints and permission tests as part of this step.
4. Connect sign-in and build the complete first loop: publish Plate → share to one Table → reply → save → reopen original or exact discussion. Verify with two members and a non-member.
5. Add formal Table Requests and saves that reopen their ongoing threads, then complete initial search and Table image browsing. This first loop alone is not the entire MVP.

Remaining wireframes and additional research responses do not block starting the first loop. Refine interfaces through the working app. No arbitrary message saving, native application, private author profiles, or external search service is required for this foundation.

## Pending setup permissions

- Active non-main branch: awaiting owner confirmation; no Git command executed.
- Local npm dependency installation and verification commands: awaiting owner answer to the setup question.
- Initial package proposal: Next.js, React, React DOM, TypeScript/types, Tailwind/PostCSS integration, ESLint/Next configuration, Supabase JavaScript and SSR clients. Exact compatible versions will be checked before installation.
- Hosted projects, credentials, email delivery, deployments and billing: not configured or authorised. Do not ask the owner to paste secrets into chat.
