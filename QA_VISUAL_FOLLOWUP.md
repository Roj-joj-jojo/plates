# Visual follow-up — 18 October 2026

## Compact mobile sizing — 18 October (latest)

Owner reports hybrid desktop composer/mobile floating placement looks good but whole mobile interface feels too large; explicitly clarified overall density rather than fitting all photos in a row. Same-session branch and scoped check/browser approvals retained. Read current ledger/shared UI and installed Next CSS guide.

- Below640px, PageHeader uses a single title/account-control row, full-width description below,12px vertical padding,20px heading/13px description. Back link remains a separate row when present. Desktop header typography/description placement and centring retained. Smaller20px bell/mail and32px account avatar keep44px control targets.
- Shared PlateAuthor mobile avatar40px/name16px/metadata13px, desktop48/18/14 retained; linked display name now explicitly44px tall. Shared post body14px/20px line height on phones, desktop16px/24px retained. Feed/Menu/Table root-detail/reply cards use16px phone padding; tighter Feed title/content/footer and photo spacing. Gallery still two columns on phones, three from640px; no content/image/access changes. Mobile Feed floating action48px rather than56px, existing accessible name/destination/safe-area positioning retained.
- Final lint/typecheck/Webpack production build passed; preview restarted60134 at127.0.0.1:3000. Prior preview shutdown reported destination-stream interruptions. No data/schema/dependency/Git/deletion/worker/remote operation.

Browser: existing Firefox owner was usable again. After settled reload, actual390px Feed showed compact title/icons on one row, smaller author/less padding and mobile floating action; desktop Feed later showed composer/larger typography/no floating action. Existing80% browser zoom unchanged. Native browser switched out of responsive mode during observations; no agent viewport-size changes or new native tab this turn, left owner's current state intact. No full native360/scroll/form-destination/keyboard acceptance claimed.

IAB known question/reply fixture360/390 had no horizontal overflow; computed h1=20px, author links16px, header/back controls44px tall. Saved/reviewed `/private/tmp/plates-compact-mobile-question.jpg`; viewport reset/tab retained; captured errors0. Original unseen introduction unchanged. No posting/save/like/upload/account/privacy/tour changes. Actual phones, text zoom/full screen-reader, every long-title/panel/data variant, Add a Plate actual destination/scroll clearance and earlier Batch8 rehearsal remain separate. Next owner visual review then Batch8.

## Desktop composer/mobile floating Add a Plate — 18 October (latest)

Owner explicitly chose option B in desktop Feed and option C in mobile Feed. Added FeedCreateAction using existing profile context/avatar/Button/Plus: compact bordered desktop composer above Recent Plates, normal document flow;56px circular fixed mobile action with accessible Add a Plate name/title. Both link to existing `/feed/new`, CSS switches at shared768px navigation breakpoint. Floating action sits80px plus safe-area above viewport bottom; added80px extra mobile Feed-end padding to allow final content/links to scroll clear. No other page's creation controls changed; existing posting form/data rules retained.

Read handover/current files/installed Next CSS guide. Same-session branch/local-check/browser approvals retained. Final `npm run lint`, `npm run typecheck`, `npm run build -- --webpack` passed. Stopped66016 (shutdown stream interruptions), rebuilt and restarted preview93955 at127.0.0.1:3000. No new dependencies or Git/DB/worker/deletion/remote project operations.

Browser verification attempted but **not passed**: Firefox temporary Feed tab's AX title/URL changes, while screenshot stays on old Tables and content AX is absent. Refreshing app binding/window raise did not resolve it; attempted responsive-mode shortcut produced no confirmed UI change. Closed temporary tab back to existing Tables; existing80% zoom untouched. In-app stale context resolved with reload; clicking Feed reached peer's unfinished introduction, left intact. QA tab retained, no viewport override applied. No current desktop/360/390 screenshot, duplicate-visible-control, floating scroll, keyboard or actual destination acceptance claimed. No posting/uploads/save/like/account/privacy/introduction mutation.

Next: owner reviews current Feed at desktop and360/390 mobile, confirms desktop composer/mobile floating control only, scrolling/end-link clearance and both entry points reaching blank Add a Plate form. Browser acceptance remains outstanding; broader Batch8 gates unchanged.

## Table consistency, tagline and placement pictures — 18 October (latest)

Owner asked to extend the recent post styling to Tables/rest of app, make Table header consistent, change the brand tagline to Food is worth sharing, and explore a better Add a Plate location. Follow-up explicitly requests simple example pictures of each proposed location before building one. Existing feature-branch and scoped local-check/browser authorisations retained; no Git inspection.

- Extracted shared PageHeader; Table conversation uses same banner spacing/account-control placement/title treatment. Table-specific Search/Members/Photos/Ask tools now sit in a light toolbar below it. Content shares the header's maximum width/padding. Table messages use card surfaces.
- Reused PlateAuthor for conversation metadata:48px avatar/18px display name, only display name links profile,14px plain muted username at right. Applied to Table messages, question/message/shared-Plate detail, replies and original Plate comments. Moved timestamps below content/right; day dividers and full accessible timestamp retained. Standalone root shows short date/time, day-grouped entries show time. Edited appears once in metadata, with full edited time on timestamp container tooltip.
- Quieter regular muted View plate links in Table shared-Plate previews/discussion, Search and profile; profile date below content. Menu says View current plate to distinguish live source from frozen saved copy. Existing return URLs, private/unavailable notices, saves/provenance and content bodies retained.
- Changed branded tagline in both navigation frames, introduction and root page metadata. No creation placement chosen or implemented. Created three static desktop/phone wireframes only: `/private/tmp/plates-create-option-a.png` navigation Create, `-b.png` Feed composer, `-c.png` floating action. SVG sources/render script also in/private/tmp. All visually inspected. Used existing Sharp dependency for deterministic simple wireframes; no external image generation/upload or new dependency.

Final lint/typecheck/Webpack production build passed, including a final single Edited-label correction. Preview66016 running127.0.0.1:3000 (earlier84814/3958 superseded); first stopped preview printed destination-stream interruptions. Browser checks before that tooltip-only correction:1280 Table author18px/plain handles/date-below, no overflow;360/390 no overflow/conversation still scrollable; Members/Photos/Ask panels opened; Escape returned focus to opener; Ask opened with Enter; question link opened correct root and three existing replies;390 reply page no overflow/display-name-only metadata links/full accessible time labels. Final rebuilt question reload passed, captured errors0. Viewport reset/QA tab retained. Saved and reviewed screenshot `/private/tmp/plates-table-consistency-desktop.jpg`.

Limits: no posting/save/like/uploads/privacy/account/tour completion; normal visible Table read receipts remain enabled. Search/profile/Menu link styling and populated Plate comments/shared-photo detail not freshly browser exercised; source/type/build checked. No full screen-reader/physical-device/zoom/edited fixture/mutation/failure matrix; earlier Batch8 gates unchanged. No DB/worker/Git/dependency/deletion/remote project action. Next owner reviews the pictures and chooses placement, then visual acceptance and Batch8.

## Display identity and View plate correction — 18 October (latest)

Owner clarified that display name beside avatar should grow, not @username; avatar should grow too, username/category should retain prior smaller sizing, and only display name links to profile. Owner also rejects category fallback card titles/title hyperlinks and requests a light left-aligned View plate link beneath content.

- Shared Feed/detail author presentation now has18px semibold display name/48px avatar, right-side14px regular muted @username/category as plain text. Only display name links to profile; date remains right aligned.
- Feed photo-only/link-only/long-body fallback cards have no invented category heading. Existing short non-mention opening-line headings remain plain text, without duplicate body text. No separate title field/schema introduced. Plate detail's empty-body page heading uses neutral Plate rather than category.
- Feed View plate link is muted/regular/underlined,44px high, below content on left opposite date and above actions. Existing validated source/card return URL retained; gallery/external links/actions independent. Prior linked-heading recommendation is superseded.

Final lint/typecheck/production Webpack build passed; preview restarted84814 at127.0.0.1:3000. Rebuilt IAB desktop verified18px name/48px avatar/14px username, exactly one profile link/no username link;360/390 detail no overflow. Firefox owner Feed at unchanged80% confirmed category appears once on photo-only cards, absent card heading there, plain text headings elsewhere, View plate below gallery at left/date right, and View plate→correct full Plate with neutral page heading. Screenshot/private/tmp/plates-final-card-layout.jpg saved and visually reviewed. Temporary native tab closed; IAB viewport reset/tab retained; captured IAB errors0.

No posting/fixture/save/like/account/privacy/tour-completion mutation, DB/worker/dependency/Git/deletion/remote action. Same-session branch and local-check/browser approvals retained. No fresh phone Feed/native zoom/full-screen-reader/real-mutation/failure-matrix claim; prior Batch8 limits remain. Owner visual acceptance next.

## Right-alignment correction — 18 October (latest)

Owner clarified that @username/category belong at the right on the avatar/name row, and date at the right beneath content. Updated shared PlateAuthor to wrap a left identity group and right-aligned metadata group, vertically centred when space permits; username increased14→16px, regular400 weight/muted colour retained. PlateDate now right aligned. Shared Feed/detail component use retained; mobile metadata wraps below identity when needed. Previous left-alignment descriptions are superseded by this clarification.

Final lint/typecheck/production build passed; preview restarted session31613. Rebuilt IAB desktop1280 verified same-row vertical centres,16px/400 username, muted colour, right-aligned date. Detail360/390 verified right alignment/no horizontal overflow; errors0. Screenshot/private/tmp/plates-right-metadata-desktop.jpg saved; viewport reset/tab retained. Detail options reserve their own right-side space, as before. Feed uses the same component but was not separately browser revisited in this narrow correction. No data/account/save/like/DB/worker/Git/dependency/deletion/remote actions. Physical-device/screen-reader/other earlier Batch8 limits remain.

## Header balance and Plate metadata refinement — 18 October (latest)

Owner requested equal space above/below header icons, avatar/display-name top row, @username/category below at card left, and a quieter date below content but before actions. Shared PageLayout icons now vertically centred at sm+; existing narrow stacked header preserved. New PlateAuthor/PlateDate components apply consistent metadata to Feed and Plate detail. Visible date is short London calendar date (e.g.15 Oct2026); full timestamp retained in title/aria-label and machine-readable datetime. No author/account/content/save/access changes.

Final lint/typecheck/production Webpack build passed. Preview stopped/rebuilt/restarted session3777 at127.0.0.1:3000; shutdown destination-stream interruptions were observed, with no captured rebuilt IAB client errors. IAB desktop1280 measured27px above and27px below icon group; metadata/content left coordinates matched429px; date measured after photo and before actions with full accessible timestamp. Plate detail360/390 had no horizontal overflow. Existing Firefox owner Feed at unchanged80% zoom confirmed actual card ordering/short date below gallery and balanced header. Temporary native tab closed back to prior user tab; IAB viewport reset/tab retained. Proof/private/tmp/plates-metadata-refinement-phone.jpg.

Same-session branch confirmation and approved local-check/browser scope retained. No Git/DB/dependency/deletion/worker/remote action, no posting/save/like/account/privacy/tour-completion mutation. Narrow Feed itself, long-name/no-username/invalid-date runtime cases, physical phones/zoom enlargement/full-screen-reader and broader Batch8 integration remain unexercised. Owner visual review remains next.

## Implemented and checked — 18 October

Owner approved the recommendation and requested implementation. Same-session non-default feature branch confirmation and approved local-check/preview/browser scope retained. No Git inspection used.

- Shared PageLayout creation actions now sit below the dark banner, aligned right with content. Applies to Feed Add a Plate and Tables Create a Table.
- Manage your people now follows SearchForm. Shared Search/People/Menu view navigation is compact, borderless and uses pale fill/bold/current-page selection without underlining; normal keyboard focus outlines retained.
- People has Following/Followers/Requests; Requests contains Received/Sent. All four existing list URLs, list-specific pagination and backend reads retained; incoming request count stays on Requests, which remains selected on Sent.
- Plate interactions use heart/count and comment/count, with explicit accessible action names and pressed state; compact Save/Saved bookmark presentation. Feed footer puts save at right and no longer repeats Open Plate. Linked Feed headings open detail with existing return context. Short non-mention opening lines become the heading once; long/mention-bearing body stays intact with a category heading. Gallery and external links remain independent.
- Saved bookmark opens Menu, not unsave. Removed-copy restore, source-link saving, private photo preparation, errors and progress remain available; no schema/permission/save-policy change.

Final `npm run lint`, `npm run typecheck` and `npm run build -- --webpack` passed. Existing preview stopped through its agent execution session; shutdown logged an interrupted destination stream. Rebuilt browser paths passed and captured no in-app client errors. Preview now running execution session53804 at127.0.0.1:3000; worker not operated.

Scoped browser verification: desktop1280 Search management link below form/no selection underline or borders; keyboard Requests→Sent with active parent/current direction;360px People controls44px/no overflow;390px Search/detail/Saved→Menu; phone shared Create Table action outside header/44px/no overflow. Existing Firefox owner session at its unchanged80% zoom confirmed Add a Plate below banner, real liked/unliked and saved/unsaved card presentation, short/photo heading fallback and heading→correct Plate destination. Temporary native tab closed, original page retained. Existing peer's unseen introduction preserved. No follow/save/like/post/upload/account/privacy/tour-completion mutation performed.

Proof: `/private/tmp/plates-visual-followup-search.jpg`, `/private/tmp/plates-visual-followup-people.jpg`; screenshots visually reviewed. In-app viewport override reset, QA tab retained. No DB commands, activation, dependencies, deletion, Git, deployment or remote project actions.

Limits: Feed itself browser-checked in Firefox desktop, not freshly at phone widths (peer Feed introduction left intact); phone shared layout and Plate-detail controls were checked. No fresh real mutations, photo processing/failure, populated incoming-count badge, long/mention-heading browser matrix, physical devices, zoom enlargement or screen-reader suite. Existing access/retention and Batch8 release gates remain separate. Owner visual acceptance of this revised design remains next.

## Owner feedback

After Batch7, owner supplied three screenshots and reports: Feed Add a Plate placement competes/misaligns with header icons; Search Manage your people should sit below the search form; four Plate footer actions and four large People navigation controls are visually excessive; selected Following underline collides with descender and underlining is unwanted.

Batch7 source/build/scoped browser passes remain valid evidence, but visual design acceptance is reopened by this feedback. Do not proceed as if owner approved the new tabs/action layouts.

## Research performed

Public official documentation only; no third-party account sign-in, live app inspection or project content sent to research sites. Documented patterns can differ by version/platform; historical product announcements do not establish exact current UI.

- Instagram: official save announcement describes bookmark action at lower right of a post and private saved destination. https://about.fb.com/ja/news/2016/12/instagram_save/ (2016 announcement, Japanese).
- Instagram: official Following/Favorites announcement describes choosing feed views from a dropdown at the Instagram heading. https://about.fb.com/news/2022/03/two-new-ways-to-control-your-instagram-feed/ (2022).
- Discord: Friends List 101 describes All/Online/Pending/Blocked and combines received and sent requests under Pending. https://support.discord.com/hc/en-us/articles/217674288-Friends-List-101 (updated February2025).
- Letterboxd: welcome guide groups watched/liked/rated/watchlist/log/list interactions in its Film actions controls. https://letterboxd.com/welcome/ . FAQ describes explicit + Log/+ creation. https://letterboxd.com/about/faq/ . Neither establishes that creation belongs outside a header everywhere.

## Recommended direction (proposal, not implemented)

1. Put Add a Plate in a content action row below the dark banner, above the first Feed card, aligned with the card edge. Header retains page identity and account/notification controls. Apply the same creation-placement rule to equivalent pages when implementation scope is agreed.
2. Put Manage your people directly below SearchForm, matching the secondary Find people link's position after People content.
3. Plate footer: compact heart/count and comment/count on left, bookmark Save/Saved on right. Link the content-derived Plate heading to detail, avoiding a fourth footer Open Plate action. Keep image gallery and other nested controls independent; do not make an enclosing link swallow controls. Accessible action names, minimum44px targets, pressed state, errors and processing remain necessary. Preserve frozen saves; saved bookmark opens Menu rather than silently becoming an unsave toggle.
4. People: compact Following / Followers / Requests navigation instead of four full-width outlined buttons. Received and Sent live inside Requests, with incoming count visible at main Requests entry. Preserve all four existing list destinations/data permissions. This follows Discord's grouping concept without introducing mutual-friend semantics.
5. Selected-view styling: compact pale aubergine fill and bold text, no underline or four separate large borders; retain aria-current and visible keyboard focus outline. Same treatment for Search and Menu where applicable.

The recommendation synthesises sources with owner's explicit feedback; it is not a claim that any one reference app uses this exact Plates layout. No design option approved yet by owner beyond the stated feedback. No application changes, tests, services, database operations, dependencies, deletion, Git or deployment occurred in this research turn.
