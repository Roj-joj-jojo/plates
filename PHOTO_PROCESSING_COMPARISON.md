# Photo processing choices for the friends' alpha

Research date: 26 October 2026. Source inspection and public documentation only. No implementation, browser conversion benchmark, provider account, upload, subscription or deployment has occurred.

## Decision to make

Choose the simplest reliable route to the friends' alpha at an acceptable ongoing cost. Existing worker implementation is evidence about current behaviour, not a reason to preserve its architecture. Hosting is not selected. The owner is comparing managed image services while the agent assesses device-side processing. Modern capable phones are the initial audience.

## Managed image services: what the owner should compare

Cloudinary's Image & Video APIs / Image API is the appropriate product category. Its Digital Asset Management product addresses a different need.

| Look for | What this app needs |
| --- | --- |
| Input and output formats | JPEG, PNG, WebP and genuine HEIC/HEIF input; resized WebP or JPEG output; correct orientation. |
| Output sizes | Display image fitting inside 2048×2048 without upscaling; small preview fitting inside 640×640. Profile/Table pictures also use this upload pipeline. |
| Private access | Originals AND derived images protected; time-limited access after our app checks permission. Check the actual plan required. A signed link is not automatically an expiring link. |
| Metadata | GPS/camera metadata removed from shared outputs; understand whether originals are retained unchanged. |
| Price | Processing, originals, generated sizes and delivery bandwidth; next paid tier; what happens at the free limit; usage alerts versus an actual spending cap. |
| Storage flexibility | Can our backend retrieve the processed image and store it privately in Supabase, or must Cloudinary remain the image host? Count transfer in either arrangement. |
| Saved copies and removal | Can we retain an immutable small copy for a saved Plate, associate it with the source, and honour our existing access/erasure rules? Check deletion of originals, derivatives, backups and cached copies. |

Cloudinary confirms HEIF/HEIC upload and transformation support in its [format documentation](https://cloudinary.com/documentation/image_format_support). Its [optimisation documentation](https://cloudinary.com/documentation/image_optimization) describes metadata removal from transformed outputs; the original remains unchanged.

Its [Free plan](https://cloudinary.com/pricing) currently has 25 monthly credits. [Billing documentation](https://cloudinary.com/documentation/billing_and_plans) says processing, storage and bandwidth consume the same allowance: 1 credit represents 1,000 transformations OR 1 GB storage OR 1 GB image delivery. Example: 2,000 ordinary derivatives + 5 GB stored + 10 GB delivered would consume roughly 17 credits, subject to actual metering and special transformation rules. This is illustrative, not our expected usage. Stored originals/derivatives can accumulate across months. Inspect the next paid tier rather than assuming a gradual price increase.

Cloudinary's [access documentation](https://cloudinary.com/documentation/control_access_to_media) is particularly important: `private` protects originals but transformed versions are public by default; `authenticated` protects both. Ordinary signed delivery URLs do not themselves prevent sharing or provide time-based expiry. CDN access tokens require Advanced or higher. There is also an expiring `private_download_url` route, but Cloudinary says it bypasses CDN caching and costs twice the delivery bandwidth; it recommends against embedding these URLs in websites. These are different mechanisms, not evidence that every expiring URL requires a premium plan.

Two possible managed designs need comparing: provider processes and hosts the photos, or provider processes them and the app stores outputs privately in Supabase. The second may preserve our current delivery/access model but still needs a reliable upload/finalisation exchange and handling of provider-side copies. Neither is implemented or selected.

## Four-provider comparison supplied by the owner

Checked 26 October 2026. USD list prices before tax and optional services. No accounts or service behaviour inspected. Service capabilities below are documented, not integrated acceptance.

| Candidate | Processing/storage/delivery pricing | Initial assessment |
| --- | --- | --- |
| ImageKit | Free: 3 GB stored, 20 GB delivery/month. Lite: $9/month includes 10 GB storage/40 GB delivery, then $0.10/GB storage and $0.50/GB delivery. | First candidate for a free friends' alpha: HEIC transformation and expiring signed URLs are documented on free plans. |
| Cloudflare Images | Hosted storage purchased in $5 increments per 100,000 images/month; delivery $1/100,000. Separate remote-image transformation route includes 5,000 unique transformations/month free, then paid $0.50/1,000. | Strong low-cost hosted alternative; HEIC and private expiring tokens documented. Images is a different product from Containers priced earlier. |
| Cloudinary | Free 25 shared credits; Plus displayed at $99/month on monthly billing ($89/month equivalent annually). | Capable conversion; shared credits and private-expiry delivery mechanisms need more care for our model. |
| Bunny | Storage alone starts $0.01/GB, but image conversion uses Optimizer at $9.50 per Pull Zone/month, plus storage and CDN transfer. | Capable combined stack, but owner-supplied Storage page alone does not solve conversion and is not the total cost. |

Sources: [ImageKit plans](https://imagekit.io/plans/), [Cloudflare pricing](https://developers.cloudflare.com/images/pricing/), [Cloudinary pricing](https://cloudinary.com/pricing), [Bunny Optimizer pricing](https://bunny.net/pricing/optimizer/), [Bunny billing FAQ](https://bunny.net/faq/). Cloudflare's published storage-increment explanation is also available in its official [pricing page](https://developers.cloudflare.com/images/pricing/?ref=arabroot.io); inspect the actual selected subscription quote before purchase.

ImageKit details: its [transformations guide](https://imagekit.io/docs/transformations) explicitly accepts HEIC and converts to JPEG/PNG/WebP. [Basic security](https://imagekit.io/docs/media-delivery-basic-security) is available on all plans and supports expiry. Enforce signed URLs for ALL image requests; this is off by default, and merely marking files private also allows named transformations. App must verify current viewer access before signing. Its [optimisation guide](https://imagekit.io/docs/image-optimization) describes default metadata stripping and EXIF rotation. Free input/upload limit 25 MB is above our existing10MB rule; free output limit25MP is above our2048px maximum. The two included users are provider dashboard seats, not two app users.

ImageKit free limits are hard limits: delivery stops at20GB/month and new uploads stop at3GB stored. At an illustrative5MB per retained original,3GB is only roughly600 originals before any other uploaded copies; do not use the vendor's generic file-count example as our photo capacity. Bandwidth is based on actual delivered output size; no measured alpha forecast exists. Lite permits metered overages, so cost alerts and actual limits still matter.

Cloudflare details: [HEIC support](https://developers.cloudflare.com/changelog/post/heic-support/) and [formats/limits](https://developers.cloudflare.com/images/get-started/limits/) confirm HEIC input and10MB hosted upload limit. [Private image delivery](https://developers.cloudflare.com/images/optimization/hosted-images/serve-private-images/) supports expiring tokens signed by our existing backend; no separate continuously running conversion process is necessary. Every relevant image must require a signature, and no variant may bypass it through public-access settings. Remote transformations of existing Supabase photos still need a private-origin design; free transformations are not a free hosted-image storage plan. Saved immutable copies, provider deletion/variants/cache and private source handling remain integration work.

Bunny details: provider's [changelog](https://github.com/BunnyWay/documentation/blob/main/changelog.mdx) lists HEIC/HEIF input GA26June2026. Official [token authentication implementation](https://github.com/BunnyWay/BunnyCDN.TokenAuthentication) documents expiring signed URLs. Confirm signing covers transformation parameters and close public origin/alternate host access if choosing this stack. No paid zone/account configured.

Recommendation based on documented fit: assess ImageKit first and Cloudflare Images second against the same upload/authorisation/Saved-copy flow. These services could take over conversion without a continuously running photo worker. Full migration still includes authoritative asset finalisation and snapshot association; neither a dynamic image URL nor a provider's signature automatically implements application permissions or independent Saved copies. Device-side processing remains a credible alternative, but a suitable managed service may need less custom conversion code. This is an assessment, not an owner selection or deployment approval.

## Additional Cloudflare route: R2 storage plus Images processing

Owner supplied R2 signup screenshot and [getting-started page](https://developers.cloudflare.com/r2/get-started/). R2 Standard includes10GB-month storage,1million Class A operations and10million Class B operations monthly, with no R2 egress charge. This is roughly10GB continuously stored through a month, not10GB additional permanent capacity accumulated every month. Excess Standard storage$0.015/GB-month; other connected services can charge separately. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

The hosted Images storage comparison above is NOT the only Cloudflare design. R2 can store originals/outputs while managed Images performs conversion. Images pricing includes5,000 unique transformations monthly and charges paid excess at$0.50/1,000. Browser processing plus R2 is also possible. Either arrangement needs authenticated upload/finalisation, private delivery and Saved-copy integration; R2 storage alone does not convert images.

Cloudflare's [transform-before-R2 tutorial](https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/) explicitly requires an Images Paid subscription for its Worker Images binding. Paid Images can use external storage instead of buying hosted Images storage; do not assume subscription name itself establishes an additional$5 storage bill, or guarantee the full private pipeline costs$0 without confirming selected subscription and Worker usage. The [Images binding](https://developers.cloudflare.com/images/optimization/binding/) processes raw private R2 bytes, avoiding a public source URL, and supports on-demand conversion rather than a continuous native worker. Confirm subscription eligibility/current billing, cache/access design and request allowances for this route before a final cost comparison. No signup button clicked or account inspected; screenshot only establishes offered R2 terms, not activation.

This expands the Cloudflare candidate materially. ImageKit's3GB versus R2's10GB is a genuine storage difference; prior first-candidate assessment does not settle the combined processing/privacy/implementation comparison.

Follow-up pricing clarification,26October: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) confirms Workers Free includes100,000 requests/day with10ms active CPU per invocation. Accessing R2 through the [Workers API](https://developers.cloudflare.com/r2/get-started/workers-api/) does not itself require Workers Paid ($5/month). Images pricing explicitly bills external storage users only for transformations, and its R2 example totals$2.72 without a$5 hosted-Images storage minimum. Therefore published allowances support a potentially$0 Cloudflare starting scenario: R2 Standard within10GB-month/operation allowances, Images within5,000 unique transformations/month, and a request handler within Workers Free limits. Images Paid activation is required for the private-byte Images binding but is distinct from purchasing hosted Images storage or Workers Paid. This is a pricing/design inference, not measured application fit: authentication/finalisation must fit the10ms CPU budget or Workers Paid would add$5/month. Two output sizes per new photo would ordinarily use two transformations, approximately2,500 photos/month within5,000, before other transformations. No account or runtime verification performed.

## Device-side processing: what the source shows

Current upload entry points are Plate creation/editing, Table messages/replies and profile/Table pictures. They use `src/components/connected-actions.tsx` and `src/components/picture-settings.tsx`, with shared selection UI. They currently upload originals into private staging, then poll for worker completion. Plate uploads permit six photos and Table attachments four, processed sequentially.

`scripts/process-plate-image.mjs` accepts at most 10,000,000 bytes and checks at most 50,000,000 decoded pixels. It converts HEIC through heic-convert, corrects orientation and produces a WebP within 2048×2048. `scripts/process-menu-preview.mjs` produces a WebP within 640×640. Browser canvas APIs can provide equivalent dimensions and approximate quality, but not guaranteed byte-identical output.

The project already indirectly installs libheif-js 1.23.5 through heic-convert/heic-decode. Its installed README documents a browser WebAssembly bundle. The bundled ES module is 2,043,959 bytes uncompressed; the separate WASM binary is 1,463,506 bytes. These are local file sizes, NOT measured browser download sizes. Browser integration/build compatibility has not been tested. A browser import should be lazy-loaded only when native decoding is unavailable and HEIC conversion is needed. Making a transitive package an intentional browser dependency needs explicit dependency approval; no install or lockfile change occurred.

Browser support sources: [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [canvas export](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), [WebKit HEIC support](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/) and [libheif-js maintainer documentation](https://github.com/catdad-experiments/libheif-js). Native HEIC support must be feature-detected; a modern phone alone does not establish format support in every browser. Requested WebP export can fall back to PNG, so inspect the actual output type.

## Resource sizing

Processing one image at a time is appropriate for the initial audience. Calculated raw RGBA pixel buffers are approximately 48 MB for 12 megapixels and 192 MB for 48 megapixels, before decoder/canvas copies. A square 2048-pixel output buffer is about 16.8 MB; a 640-pixel preview buffer about 1.64 MB. These are arithmetic lower bounds for those buffers, not measured total memory or device performance. Do not multiply full decode memory by all six selected photos by decoding them concurrently.

Proposed normal path: decode one image, draw to the bounded display size, derive the small preview, export blobs, release bitmap/canvas resources, then continue. Move supported work to a browser worker to keep the interface responsive. HEIC colour/orientation and conversion speed remain the focused proof items; there is no useful honest seconds-per-photo promise without a browser run. Keep the original 10 MB selection rule for the initial change unless the owner explicitly approves accepting larger originals and resizing them before upload.

## Removing the continuous worker

The browser encoder alone is a small change. Complete worker removal is a medium application/data-flow change with four work packages:

1. Shared browser processor with native decode, HEIC fallback, bounded outputs and progress/error handling.
2. Integrate all upload entry points and preserve draft/retry behaviour; replace waiting for background completion with trusted request-based finalisation.
3. Produce the small derivative during original upload; at save time, make an authorised private copy for the saver, preserving source revision, ordering, snapshot and erasure behaviour.
4. Focused upload/privacy/retry/save acceptance and an additive transition for existing assets, rather than deleting the old pipeline or rewriting unrelated app code.

Backend validation is still needed because browser output/type/dimension claims can be bypassed. It can run as bounded requests in the existing application hosting instead of a continuously polling service. It must authenticate the user, validate actual staged bytes and dimensions, reserve authoritative object paths, finalise idempotently and retain removal/erasure barriers. Any trusted re-encoding needed to sanitise bytes is backend work, but no longer conversion of arbitrary full-resolution originals. No service credential belongs in the browser. This is a proposed design, not a tested architecture or a promise of zero backend resource cost.

Saved Menu photos currently use saver-owned copies generated when a Plate is saved. This is why the change includes database functions and Storage permissions, not just a browser helper. An upload-time derivative plus authorised save-time copy can remove conversion at save time without needing the uploader online. It still requires designing the derivative's authoritative association and validating access and source state during copying. Existing historical photos need a compatible preview path; no destructive migration/backfill is implied.

Effort sizing: one focused working session is a reasonable target for proving the browser conversion path on representative JPEG/PNG/HEIC. Full integration is several further focused sessions across the four work packages, rather than a quick component edit. This is a preliminary scope estimate; it is not a delivery deadline and no test has yet established the main HEIC assumption. Re-estimate after that proof instead of commissioning a broad benchmark campaign.

## Current assessment and next decision

Device-side processing is technically credible for the stated modern-phone audience and could eliminate separate continuous-worker hosting while retaining Supabase. Managed processing could reduce custom conversion code further; private delivery and plan pricing determine whether it is simpler overall. Neither should be rejected because the existing worker already exists.

Compare the owner's managed-service findings with this scope. Then choose a route and obtain non-default branch confirmation before implementation. No signup, purchase, provider integration, dependency change, Git operation or external upload is authorised by this research. The existing pipeline remains untouched.
