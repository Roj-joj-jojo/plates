// Local-only end-to-end image check. Requires the M4a migration and running media worker.
// Leaves one clearly labelled synthetic Plate and its private image objects; no cleanup runs.
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const mail = "http://127.0.0.1:54324/api/v1";
const app = "http://127.0.0.1:3000";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(address) {
  const response = await fetch(address, { signal: AbortSignal.timeout(10000) });
  check(response.ok, `Local mail API returned HTTP ${response.status}`);
  return response.json();
}

async function api(path, token, options = {}) {
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
}

async function sessionFor(email) {
  const before = await getJson(`${mail}/messages`);
  const oldIds = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: false }),
  });
  check(sent.status === 200, `Existing local account code request returned HTTP ${sent.status}`);
  let messageId;
  for (let attempt = 0; attempt < 20; attempt++) {
    const listing = await getJson(`${mail}/messages`);
    messageId = listing.messages.find((message) => !oldIds.has(message.ID)
      && message.To.length === 1 && message.To[0].Address === email)?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(messageId, "Fresh local code did not arrive within 20 seconds");
  const message = await getJson(`${mail}/message/${messageId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, "Fresh local code was missing");
  const verified = await api("/auth/v1/verify", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verified.status === 200, `Local code verification returned HTTP ${verified.status}`);
  return verified.json();
}

async function clientFor(email) {
  const session = await sessionFor(email);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.setSession({ access_token: session.access_token,
    refresh_token: session.refresh_token });
  if (error) throw error;
  return { client, session };
}

async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const listing = await getJson(`${mail}/messages`);
  const emails = [...new Set(listing.messages.flatMap((message) => message.To.map((to) => to.Address)))
    .values()].filter((email) => /^plates-local-[a-f0-9-]+@example\.test$/.test(email));
  check(emails.length >= 2, "Two synthetic local test accounts were not found");

  const owner = await clientFor(emails[0]);
  const outsider = await clientFor(emails[1]);
  const { data: categories, error: categoriesError } = await owner.client.from("categories")
    .select("id").eq("slug", "meal").single();
  if (categoriesError) throw categoriesError;
  const { data: intents, error: intentError } = await owner.client.rpc("request_plate_upload");
  if (intentError) throw intentError;
  const intent = intents?.[0];
  check(intent, "No upload intent was returned");
  const pixels = await sharp({ create: { width: 2400, height: 1200, channels: 3,
    background: "orange" } }).png().toBuffer();
  const { error: outsiderStageError } = await outsider.client.storage.from("staged-assets")
    .upload(`${crypto.randomUUID()}/unrequested.png`, pixels, { upsert: false });
  check(outsiderStageError, "An outsider uploaded without an intent");
  const { error: directDestinationError } = await owner.client.storage.from("plate-media")
    .upload(`${crypto.randomUUID()}.webp`, pixels, { upsert: false });
  check(directDestinationError, "Browser wrote directly to the served bucket");
  const { error: stageError } = await owner.client.storage.from("staged-assets")
    .upload(intent.staged_path, pixels, { contentType: "application/octet-stream", upsert: false });
  if (stageError) throw stageError;
  const { error: stagedReadError } = await owner.client.storage.from("staged-assets")
    .download(intent.staged_path);
  check(stagedReadError, "Browser read staged original bytes");

  let assetId;
  for (let attempt = 0; attempt < 60; attempt++) {
    const { data: state, error } = await owner.client.from("media_upload_intents")
      .select("state, asset_id, error_message").eq("id", intent.intent_id).single();
    if (error) throw error;
    if (state.state === "failed") throw new Error(`Worker failed: ${state.error_message}`);
    if (state.state === "ready") { assetId = state.asset_id; break; }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(assetId, "Worker did not prepare the image in time");
  console.log("PASS: staged upload processed; direct destination and staged reads denied");

  const { data: plateId, error: publishError } = await owner.client.rpc("publish_plate", {
    p_category_id: categories.id, p_body: "Local image smoke test", p_links: [], p_tags: [],
    p_attachment_ids: [assetId],
  });
  if (publishError) throw publishError;
  const { data: locations, error: locationError } = await owner.client.rpc("plate_image_locations",
    { p_plate_id: plateId });
  if (locationError) throw locationError;
  check(locations?.length === 1 && locations[0].asset_id === assetId && locations[0].width === 2048,
    "Published image location or resized dimensions are incorrect");
  const { data: signed, error: signError } = await owner.client.storage.from("plate-media")
    .createSignedUrl(locations[0].object_path, 60);
  if (signError) throw signError;
  const served = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(10000) });
  check(served.ok, `Signed image returned HTTP ${served.status}`);
  const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
  check(metadata.format === "webp" && metadata.exif === undefined,
    "Served image is not a stripped WebP");
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  const { error: anonymousReadError } = await anonymous.storage.from("plate-media")
    .download(locations[0].object_path);
  check(anonymousReadError, "Anonymous user read private Plate image");
  console.log("PASS: signed-in Plate image delivered; anonymous direct read denied");

  const cookieName = `sb-${parsed.hostname.split(".")[0]}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(owner.session)).toString("base64url")}`;
  const rendered = await fetch(`${app}/feed/${plateId}`, {
    headers: { Cookie: `${cookieName}=${cookieValue}` }, signal: AbortSignal.timeout(10000),
  });
  check(rendered.ok && (await rendered.text()).includes("Plate photo 1"),
    "Plate page did not render the processed photo");
  console.log("PASS: authenticated Plate page renders the photo");

  const { data: groupId, error: groupError } = await owner.client.rpc("create_group",
    { p_name: "Local image smoke Table" });
  if (groupError) throw groupError;
  const { data: shareId, error: shareError } = await owner.client.rpc("share_plate", {
    p_group_id: groupId, p_plate_id: plateId, p_client_request_id: crypto.randomUUID(),
    p_body: "Synthetic photo share", p_links: [], p_attachment_ids: [],
  });
  if (shareError) throw shareError;
  const gallery = await fetch(`${app}/tables/${groupId}/images`, {
    headers: { Cookie: `${cookieName}=${cookieValue}` }, signal: AbortSignal.timeout(10000),
  });
  const galleryHtml = await gallery.text();
  check(gallery.ok && galleryHtml.includes("Plate photo 1") && galleryHtml.includes(shareId),
    "Owner Table gallery did not show the shared photo and discussion");
  const outsiderCookie = `base64-${Buffer.from(JSON.stringify(outsider.session)).toString("base64url")}`;
  const hiddenGallery = await fetch(`${app}/tables/${groupId}/images`, {
    headers: { Cookie: `${cookieName}=${outsiderCookie}` }, signal: AbortSignal.timeout(10000),
  });
  check(hiddenGallery.status === 404, "Outsider could open a private Table image gallery");
  console.log("PASS: Table gallery shows the shared photo; outsider page denied");
}

try { await run(); }
catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local image error"}`);
  process.exitCode = 1;
}
