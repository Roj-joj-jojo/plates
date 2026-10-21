# Private images: implementation plan

Status: Plate-photo upload, saver-owned Menu previews, and Table message/reply
photos with the group Images view are applied and locally tested on 2026-10-09.
The image packages and five private local buckets are installed. No hosted
Storage project was contacted. This plan follows the adopted limits in
[DATA_MODEL.md](DATA_MODEL.md).

## Current implementation stage

`20261009000100_plate_images.sql` prepares private staging and served-Plate
buckets, upload intents, ready assets, author-only Plate attachment and guarded
delivery. A standalone local worker validates and converts JPEG, PNG, WebP and
HEIC, then the app can publish up to six photos with a Plate and show them in
Feed, Plate detail, shares and a Table gallery. This is the first vertical slice
for the owner's picture-upload check. The schema and permissions passed
rollback-only SQL tests, existing M2 regression, lint, typecheck and build.
After the owner approved local application, the migration, local worker and
real synthetic Storage/HTTP test passed. That test covered direct bucket
write/read denial, conversion, signed delivery, rendered Plate, Table gallery
and outsider denial. The owner later confirmed browser photo posting, thumbnail
display and the six-photos-per-Plate rejection.

`20261009000200_photo_menu_save_gate.sql` was separately approved and applied
locally after a direct Menu-save API gap was found. It prevents first saves of
photo Plates until private per-saver previews exist; rollback-only checks passed
for blocked photo saves and intact text saves.

An account-level upload-intent rate limit was approved and applied locally in
`20261009000300_upload_rate_limits.sql` after the owner raised upload abuse.
The caps are 6 unfinished, 12 per rolling hour and 60 per rolling day, counting
failed attempts. Rollback-only SQL and a concurrent real local HTTP burst passed.

`20261009000400_menu_photo_previews.sql` adds per-saver, 640 px frozen Menu
previews in a private `menu-previews` bucket. A signed-in saver asks for a
preview of the Plate's first photo; the standalone worker derives it from the
processed Plate image. The save function checks saver, Plate, first-photo and
revision lineage before accepting it. Preview jobs are limited per account and
failed jobs count. The rollback-only preview and M3 regression suites, local
processor check, lint, typecheck and Webpack build passed before application.
The owner approved local application. The migration applied, the worker was
restarted, and the applied-schema rollback-only SQL and real local Auth/worker/
Storage/rendered-Menu test passed. Another account could not read the preview,
and the saved copy remained frozen after a Plate edit. The owner confirmed the
photo Menu save and later discussion-source link in the browser.

`20261009000500_table_images.sql` was approved and applied locally. It adds
separate private `table-staged-assets` and `table-media` buckets, Table-scoped
upload intents and assets, and up to four ordered photos on a message or reply.
Image-only posts are supported. Current Table membership is required to request,
attach, locate or directly read the media; another account cannot use an issued
staging path. The Plate and Table upload attempts share the existing per-account
6 unfinished / 12 hourly / 60 daily limits, including failed attempts. The
standalone worker processes both kinds. The Table Images page now groups photos
from chat and replies with links to their source conversations, alongside shared
Plate photos. The proposed migration passed rollback-only SQL acceptance and
M2/M3/Request regressions; lint, typecheck, worker/test syntax and Webpack build
passed. After application, the Table-photo SQL suite passed again, including the
shared Plate/Table upload quota. Real local Auth/worker/Storage and rendered
Table/message/discussion/Images checks passed: non-members could neither locate
nor read Table photos. The local worker was restarted. The owner confirmed
photo-only messages, photo replies and Browse images work as intended in their
browser. No cleanup, erasure or hosted work is part of this slice.

## First usable result

A signed-in author can attach up to six images to a Plate; a Table member can
attach up to four images to an ordinary Table message or reply. A member can open
one Table's Images view to browse images in its messages/replies and on Plates
shared there. Each thumbnail opens its authorised source. Repeated Plate shares
appear as separate Table occurrences, in timeline order. Private Table images
never become readable through the global Plate feed.

An image-bearing Plate saved to Menu keeps a distinct, saver-owned 640 px preview
of its first image. Later Plate edits do not refresh it. The author can publish
an image-only Plate after ready media is attached. Existing text/link flows stay
available during the media rollout.

## Processing and storage boundary

1. An authenticated client requests an upload intent for a specific Plate or
   Table use. Database checks establish author or active membership and issue a
   random staged path. The client may upload only to its own pending path in a
   private `staged-assets` bucket. It cannot mark an image ready or attach it.
2. A dedicated local Node media worker reads pending jobs using a server-only
   credential. The credential never enters browser code, public environment
   variables, or ordinary Next.js page/route handlers. The worker reads staged
   bytes, checks the actual format, 10,000,000-byte limit, dimensions and decode
   success, then rotates, resizes to at most 2,048 px and strips metadata. It
   writes a new immutable object to the purpose-specific private bucket.
3. The worker rechecks the intended author/Table permission and image limits
   under the existing profile, Table and content locks before marking the asset
   ready and attaching it. Processing and Storage I/O occur outside database
   locks. Failed or stale intents stay unavailable and are reported to the
   uploader. No direct client operation can mark an object ready.
4. Signed-in delivery checks the relevant Plate, Table membership or Menu save
   before generating a roughly one-hour signed URL. Storage RLS independently
   protects direct object reads and guessed paths. The app never treats a URL or
   unpredictable path as proof of permission. A former member cannot refresh a
   Table image URL; an already issued URL may work until expiry.

The local private buckets are `staged-assets`, `plate-media`, `table-staged-assets`,
`table-media` and `menu-previews`. Avatars and Table cover images use the separately specified
`avatars` and `table-images` buckets in a later interface slice. Bucket creation,
policies and metadata changes belong in reviewed local migrations; there is no
hosted Storage action in this plan. Supabase documents [private-bucket RLS and
operation-specific policies](https://supabase.com/docs/guides/storage/security/access-control)
and [immutable-path uploads without upsert](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

## Database work in order

1. Add `media_assets`, typed `plate_media`, `entry_media`, `reply_media` and
   `menu_plate_preview` records with the bucket/scope, immutable lineage and
   restrictive foreign keys described in the data model. Restrict client reads
   to safe IDs/dimensions and authorised uses; do not expose raw paths, upload
   state, lineage or worker credentials through public views.
2. Add guarded upload-intent operations and narrow worker-only completion
   operations. Storage policies allow only the intended staged insert and
   authorised read. Destination buckets have no browser insert/update/delete
   grant. An attachment must be ready, use the correct bucket/scope, and fit
   the Plate (six) or message/reply (four) limit. Use existing parent guards
   and deferred final-state checks for image-only content.
3. Extend the current publish/edit/message/reply operations to accept ready
   attachment IDs. Attaching, detaching, replacing or reordering a Plate image
   increments its revision, so Table shares show `Edited since shared`.
4. Add per-saver preview preparation in the worker. Extend first-save validation
   to bind exactly one ready 640 px derivative of the Plate's first ready image
   to the saver and saved revision. A repeated save returns the existing
   reminder without replacing its preview. Unattached candidate previews are
   never client-readable.
5. Add a member-scoped Table Images query and interface. Return attachment ID,
   dimensions and source link, then obtain delivery URLs per visible image.
   Test direct Storage reads separately from the gallery's database query.

The media migration will be prepared and tested locally before any application.
Existing applied migrations will remain intact. No record or object cleanup is
enabled by creating the schema.

## Image libraries installed for local development

- `sharp@0.35.5` is now a direct production dependency for JPEG, PNG and WebP
  validation, rotation, resizing and metadata stripping. It was previously
  present only transitively with Next.js.
  The local build's Sharp input format report does **not** include HEIC. Sharp's
  [installation guidance](https://sharp.pixelplumbing.com/install/) lists the
  formats in prebuilt binaries; its [HEIC declaration](https://github.com/lovell/sharp/blob/main/lib/index.d.ts)
  requires a suitable custom libvips build.
- `heic-convert@2.1.0` is an installed candidate Node decoder for HEIC input before Sharp
  makes the final served image. The [maintainer's usage notes](https://github.com/catdad-experiments/heic-convert)
  say much conversion work is synchronous, so it belongs in a bounded worker
  thread. It is older and must pass a locally generated current-iPhone-style
  HEIC fixture before selection is final. Its TypeScript declarations would
  use the installed `@types/heic-convert@2.1.1` development dependency. The owner approved installing all three exact
  packages on 2026-10-09. They are declared in `package.json` and installed
  locally; HEIC conversion against a current iPhone fixture remains untested.

JPEG, PNG, WebP and HEIC all undergo byte-level validation; a filename or
client-provided MIME type is not trusted. The worker must cap decoded pixels
and concurrency as well as file bytes, to avoid treating a small compressed
file as a small image. If the candidate HEIC decoder fails current fixtures,
choose another reviewed decoder before enabling HEIC upload.

## Verification and release gates

- Rollback-only SQL checks: right bucket and audience, immutable paths/bytes,
  attachment counts/order/revision, image-only content, preview lineage and
  save retry, wrong-user direct writes, membership changes and guessed IDs.
- Local Storage/HTTP checks with synthetic fixtures: valid JPEG/PNG/WebP/HEIC;
  wrong format, corrupt/oversized/oversized-dimension files, EXIF orientation
  and stripping; member/non-member direct object access; signed URL expiry;
  ready-state races; shared Plate and Table-native gallery results.
- Owner browser check: upload, reorder/replace, share, save with preview, browse
  one Table's Images view, and verify access after leaving when that lifecycle
  operation exists. No private research or chat-export image should be used as
  a test fixture without separate owner direction.

The adopted 24-hour unattached-object cleanup and broader erasure need exact
deletion approval, an implementation and a local rehearsal. Until then, failed
or unused staged/candidate objects may accumulate and real-user invitations
remain gated. No cleanup command, Storage delete policy or erasure endpoint is
part of this preparation.
