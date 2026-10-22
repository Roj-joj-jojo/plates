# Dinnerfolk branding

Agreed 22 October 2026: wordmark A (font period, tracking −0.035em) and icon C (large D, tucked tomato dot). Retain the app’s oat, tomato, aubergine and black palette, fonts and layouts. Plates, Tables, Menu and Requests remain product terms.

## Assets and usage

- `public/brand/dinnerfolk-wordmark-on-light.svg`: dark lettering, #C8230A dot; transparent background.
- `public/brand/dinnerfolk-wordmark-on-dark.svg`: white lettering, #FF6347 dot; transparent background.
- `src/components/brand-wordmark.tsx`: shared accessible image with intrinsic dimensions, used in both navigation rails and sign-in. Navigation links are labelled Dinnerfolk home. Keep practical padding within navigation rather than a full letter-height margin.
- `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`: supplied icon C, automatically exposed through Next.js metadata file conventions.
- `public/brand/dinnerfolk-icon-c-192.png` and `-512.png`: supplied icon exports retained for future use; no installable-app manifest is introduced by this rebrand.
- `public/brand/BricolageGrotesque-OFL.txt`: supplied font licence.

SVG lettering is outlined, so the logo does not depend on a font loading. Supplied files were copied unchanged from the owner’s `dinnerfolk component lib.zip`; no bundled build script was executed. [Supplier notes](dinnerfolk-logo-supplier-notes.md) are retained as provenance; their `svg/`, `png/` and `source/` paths describe the supplier package rather than this repository.

## Known limits

The supplier reconstructed weight 800 from static Regular/Bold fonts rather than using the variable font’s true ExtraBold outlines. The owner accepted these assets for now. Exact font-outline refinement is deferred. The supplied Apple icon has transparent rounded corners; platform-specific full-bleed artwork remains a future refinement. Neither issue changes the chosen identity.

This is a local app-brand update. Repository/package/database/storage/event names and historical documentation remain unchanged. Local email templates use Dinnerfolk; hosted email settings are owner-controlled and are not updated by these edits. No remote project rename, domain change or deployment is included.
