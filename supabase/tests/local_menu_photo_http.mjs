// Local-only Auth, worker, Storage and rendered Menu check for M4b.
// Leaves labelled synthetic accounts, one Plate and one saved preview; no cleanup.
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
async function newLocalAccount(label) {
  const email = `plates-menu-preview-${crypto.randomUUID()}@example.test`;
  const before = await getJson(`${mail}/messages`);
  const oldIds = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true, data: { display_name: label } }),
  });
  check(sent.status === 200, `Local account code request returned HTTP ${sent.status}`);
  let messageId;
  for (let attempt = 0; attempt < 20; attempt++) {
    const listing = await getJson(`${mail}/messages`);
    messageId = listing.messages.find((message) => !oldIds.has(message.ID)
      && message.To.length === 1 && message.To[0].Address === email)?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(messageId, "Fresh local code did not arrive");
  const message = await getJson(`${mail}/message/${messageId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, "Fresh local code was missing");
  const verified = await api("/auth/v1/verify", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verified.status === 200, `Local code verification returned HTTP ${verified.status}`);
  const session = await verified.json();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.setSession({ access_token: session.access_token,
    refresh_token: session.refresh_token });
  if (error) throw error;
  return { client, session };
}
async function readyRow(client, table, id, field) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { data, error } = await client.from(table)
      .select(`state, ${field}, error_message`).eq("id", id).single();
    if (error) throw error;
    if (data.state === "failed") throw new Error(`${table} worker failed: ${data.error_message}`);
    if (data.state === "ready") return data[field];
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${table} worker did not finish in time`);
}
async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const owner = await newLocalAccount("Local Menu photo saver");
  const outsider = await newLocalAccount("Local Menu photo outsider");
  const { data: category, error: categoryError } = await owner.client.from("categories")
    .select("id").eq("slug", "meal").single();
  if (categoryError) throw categoryError;
  const { data: intents, error: intentError } = await owner.client.rpc("request_plate_upload");
  if (intentError) throw intentError;
  const intent = intents?.[0];
  check(intent, "No upload intent returned");
  const photo = await sharp({ create: { width: 1200, height: 800, channels: 3,
    background: "#cb6541" } }).png().toBuffer();
  const { error: stageError } = await owner.client.storage.from("staged-assets")
    .upload(intent.staged_path, photo, { contentType: "application/octet-stream", upsert: false });
  if (stageError) throw stageError;
  const imageId = await readyRow(owner.client, "media_upload_intents", intent.intent_id, "asset_id");
  const { data: plateId, error: publishError } = await owner.client.rpc("publish_plate", {
    p_category_id: category.id, p_body: "Local Menu photo smoke test", p_links: [], p_tags: [],
    p_attachment_ids: [imageId],
  });
  if (publishError) throw publishError;
  const { data: jobId, error: jobError } = await owner.client.rpc("request_menu_preview", {
    p_plate_id: plateId, p_expected_revision: 1,
  });
  if (jobError) throw jobError;
  const previewId = await readyRow(owner.client, "menu_preview_jobs", jobId, "preview_asset_id");
  const { data: saveId, error: saveError } = await owner.client.rpc("save_plate", {
    p_plate_id: plateId, p_expected_revision: 1, p_source_share_id: null,
    p_preview_asset_id: previewId,
  });
  if (saveError) throw saveError;
  check(saveId, "Photo Plate did not save to Menu");
  console.log("PASS: local worker prepared a private preview and saved the photo Plate");

  const { data: locations, error: locationError } = await owner.client.rpc("menu_preview_location",
    { p_save_id: saveId });
  if (locationError) throw locationError;
  const location = locations?.[0];
  check(location?.width === 640 && location?.height === 427,
    "Menu preview dimensions are not the expected 640px derivative");
  const { data: served, error: servedError } = await owner.client.storage.from("menu-previews")
    .download(location.object_path);
  if (servedError) throw servedError;
  const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
  check(metadata.format === "webp" && !metadata.exif, "Menu preview is not a stripped WebP");
  const { error: outsiderReadError } = await outsider.client.storage.from("menu-previews")
    .download(location.object_path);
  check(outsiderReadError, "Another account read the saver-owned Menu preview");
  const { data: hidden, error: hiddenError } = await outsider.client.rpc("menu_preview_location",
    { p_save_id: saveId });
  if (hiddenError) throw hiddenError;
  check(hidden?.length === 0, "Another account located the saver-owned Menu preview");
  console.log("PASS: owner can read the stripped preview; another account cannot");

  const cookieName = `sb-${parsed.hostname.split(".")[0]}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(owner.session)).toString("base64url")}`;
  const rendered = await fetch(`${app}/menu`, {
    headers: { Cookie: `${cookieName}=${cookieValue}` }, signal: AbortSignal.timeout(10000),
  });
  check(rendered.ok && (await rendered.text()).includes("Local Menu photo smoke test"),
    "Saved photo Plate did not render in Menu");
  const { error: editError } = await owner.client.rpc("edit_plate", {
    p_plate_id: plateId, p_expected_revision: 1, p_category_id: category.id,
    p_body: "Edited after Menu save", p_links: [], p_tags: [], p_attachment_ids: [imageId],
  });
  if (editError) throw editError;
  const { data: saved, error: savedError } = await owner.client.from("menu_plate_saves")
    .select("snapshot_body, snapshot_revision, preview_asset_id").eq("id", saveId).single();
  if (savedError) throw savedError;
  check(saved.snapshot_body === "Local Menu photo smoke test" && saved.snapshot_revision === 1
    && saved.preview_asset_id === previewId, "Menu save changed after editing the Plate");
  console.log("PASS: Menu rendered the saved Plate and kept its first saved copy after editing");
}
try { await run(); } catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local Menu photo error"}`);
  process.exitCode = 1;
}
