// Local-only Auth, worker, Storage and rendered Table media check for M4c.
// Leaves labelled synthetic accounts, a Table, Plate, message and reply; no cleanup.
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
async function api(path, options = {}) {
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
}
async function newLocalAccount(label) {
  const email = `plates-table-photo-${crypto.randomUUID()}@example.test`;
  const before = await getJson(`${mail}/messages`);
  const oldIds = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", {
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
  const verified = await api("/auth/v1/verify", {
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
async function uploadTablePhoto(client, groupId, colour, outsider = null) {
  const { data: intents, error: intentError } = await client.rpc("request_table_upload", {
    p_group_id: groupId,
  });
  if (intentError) throw intentError;
  const intent = intents?.[0];
  check(intent, "No Table photo upload intent returned");
  const bytes = await sharp({ create: { width: 1200, height: 800, channels: 3,
    background: colour } }).png().toBuffer();
  if (outsider) {
    const { error: stolenStageError } = await outsider.storage.from("table-staged-assets")
      .upload(intent.staged_path, bytes, { upsert: false, contentType: "application/octet-stream" });
    check(stolenStageError, "Non-member uploaded to another account's Table stage path");
    const { error: directWriteError } = await client.storage.from("table-media")
      .upload(`${crypto.randomUUID()}.webp`, bytes, { upsert: false, contentType: "image/webp" });
    check(directWriteError, "Browser wrote directly to the private Table delivery bucket");
  }
  const { error: stageError } = await client.storage.from("table-staged-assets")
    .upload(intent.staged_path, bytes, { contentType: "application/octet-stream", upsert: false });
  if (stageError) throw stageError;
  if (outsider) {
    const { error: stagedReadError } = await client.storage.from("table-staged-assets")
      .download(intent.staged_path);
    check(stagedReadError, "Browser read staged original Table photo bytes");
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const { data: state, error } = await client.from("table_upload_intents")
      .select("state, asset_id, error_message").eq("id", intent.intent_id).single();
    if (error) throw error;
    if (state.state === "failed") throw new Error(`Table worker failed: ${state.error_message}`);
    if (state.state === "ready") return state.asset_id;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Table photo worker did not finish in time");
}
async function rendered(path, session) {
  const parsed = new URL(url);
  const cookieName = `sb-${parsed.hostname.split(".")[0]}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const response = await fetch(`${app}${path}`, {
    headers: { Cookie: `${cookieName}=${cookieValue}` }, signal: AbortSignal.timeout(10000),
  });
  check(response.ok, `Local app ${path} returned HTTP ${response.status}`);
  return response.text();
}
async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const owner = await newLocalAccount("Local Table photo owner");
  const outsider = await newLocalAccount("Local Table photo outsider");
  const { data: groupId, error: groupError } = await owner.client.rpc("create_group", {
    p_name: "Local Table photo smoke test",
  });
  if (groupError) throw groupError;
  const { error: outsiderIntentError } = await outsider.client.rpc("request_table_upload", {
    p_group_id: groupId,
  });
  check(outsiderIntentError, "Non-member requested a Table photo upload");
  const messageAsset = await uploadTablePhoto(owner.client, groupId, "#5b9e7b", outsider.client);
  const messageKey = crypto.randomUUID();
  const { data: messageId, error: messageError } = await owner.client.rpc("post_message", {
    p_group_id: groupId, p_client_request_id: messageKey, p_body: "",
    p_links: [], p_attachment_ids: [messageAsset],
  });
  if (messageError) throw messageError;
  const { data: retryId, error: retryError } = await owner.client.rpc("post_message", {
    p_group_id: groupId, p_client_request_id: messageKey, p_body: "",
    p_links: [], p_attachment_ids: [messageAsset],
  });
  if (retryError) throw retryError;
  check(retryId === messageId, "Image-only message retry created another entry");
  console.log("PASS: worker prepared a private Table photo and image-only message retry was stable");

  const { data: category, error: categoryError } = await owner.client.from("categories")
    .select("id").eq("slug", "meal").single();
  if (categoryError) throw categoryError;
  const { data: plateId, error: plateError } = await owner.client.rpc("publish_plate", {
    p_category_id: category.id, p_body: "Local Table photo reply source", p_links: [], p_tags: [],
  });
  if (plateError) throw plateError;
  const { data: shareId, error: shareError } = await owner.client.rpc("share_plate", {
    p_group_id: groupId, p_plate_id: plateId, p_client_request_id: crypto.randomUUID(),
    p_body: "Discussion for a Table photo reply", p_links: [], p_attachment_ids: [],
  });
  if (shareError) throw shareError;
  const { data: thread, error: threadError } = await owner.client.from("threads")
    .select("id").eq("root_entry_id", shareId).single();
  if (threadError) throw threadError;
  const replyAsset = await uploadTablePhoto(owner.client, groupId, "#c87548");
  const { data: replyId, error: replyError } = await owner.client.rpc("reply_to_thread", {
    p_thread_id: thread.id, p_client_request_id: crypto.randomUUID(), p_body: "",
    p_links: [], p_attachment_ids: [replyAsset],
  });
  if (replyError) throw replyError;
  const { data: locations, error: locationError } = await owner.client.rpc("table_image_locations", {
    p_group_id: groupId,
  });
  if (locationError) throw locationError;
  check(locations?.length === 2 && locations.some((photo) => photo.entry_id === messageId)
    && locations.some((photo) => photo.reply_id === replyId),
  "Table gallery did not locate message and reply photos");
  for (const photo of locations) {
    const { data: served, error: servedError } = await owner.client.storage.from("table-media")
      .download(photo.object_path);
    if (servedError) throw servedError;
    const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    check(metadata.format === "webp" && !metadata.exif, "Table photo was not metadata-stripped WebP");
    const { error: outsiderReadError } = await outsider.client.storage.from("table-media")
      .download(photo.object_path);
    check(outsiderReadError, "Non-member read a private Table photo");
  }
  const { data: hidden, error: hiddenError } = await outsider.client.rpc("table_image_locations", {
    p_group_id: groupId,
  });
  if (hiddenError) throw hiddenError;
  check(hidden?.length === 0, "Non-member located private Table photo paths");
  console.log("PASS: owner read stripped Table photos; non-member could not locate or read them");

  const tableHtml = await rendered(`/tables/${groupId}`, owner.session);
  const messageHtml = await rendered(`/tables/${groupId}/messages/${messageId}`, owner.session);
  const discussionHtml = await rendered(`/tables/${groupId}/discussion/${shareId}`, owner.session);
  const galleryHtml = await rendered(`/tables/${groupId}/images`, owner.session);
  check(tableHtml.includes("Table photo") && messageHtml.includes("Table photo")
    && discussionHtml.includes("Table photo") && galleryHtml.includes("Table conversation")
    && galleryHtml.includes("Open message") && galleryHtml.includes("View discussion"),
  "Local Table/message/discussion/gallery pages did not render the photos and source links");
  console.log("PASS: Table activity, message, reply and group Images page rendered their photos");
}
try { await run(); } catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local Table photo error"}`);
  process.exitCode = 1;
}
