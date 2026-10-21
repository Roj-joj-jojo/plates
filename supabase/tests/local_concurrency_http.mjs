// Local-only concurrent HTTP check. Reuses a synthetic account from the
// populated check, creates one lasting synthetic Plate/Table/share/reply/save.
// Run: node --env-file=.env.local supabase/tests/local_concurrency_http.mjs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const mail = "http://127.0.0.1:54324/api/v1";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(address) {
  const response = await fetch(address, { signal: AbortSignal.timeout(20000) });
  check(response.ok, `Local mail API returned HTTP ${response.status}`);
  return response.json();
}

async function api(path, token, options = {}) {
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
}

async function rpc(name, token, args) {
  const response = await api(`/rest/v1/rpc/${name}`, token, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  check(response.status === 200, `${name} returned HTTP ${response.status}`);
  return response.json();
}

async function rows(path, token) {
  const response = await api(`/rest/v1/${path}`, token);
  check(response.status === 200, `Read ${path.split("?")[0]} returned HTTP ${response.status}`);
  return response.json();
}

async function existingSession(email) {
  const before = await getJson(`${mail}/messages`);
  const ids = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: false }),
  });
  check(sent.status === 200, `Local code request returned HTTP ${sent.status}`);
  let messageId;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listing = await getJson(`${mail}/messages`);
    messageId = listing.messages.find((message) => !ids.has(message.ID)
      && message.To.length === 1 && message.To[0].Address === email)?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(messageId, "Local code did not arrive within 20 seconds");
  const message = await getJson(`${mail}/message/${messageId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, "Local code was missing");
  const verified = await api("/auth/v1/verify", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verified.status === 200, `Local code verification returned HTTP ${verified.status}`);
  const session = await verified.json();
  check(session.access_token, "Local Auth session was missing");
  return session.access_token;
}

async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const listing = await getJson(`${mail}/messages`);
  const emails = [...new Set(listing.messages.flatMap((message) => message.To.map((to) => to.Address)))
    .values()].filter((email) => /^plates-local-[a-f0-9-]+@example\.test$/.test(email));
  check(emails.length >= 2, "Synthetic local accounts were not found");
  const token = await existingSession(emails[0]);
  const categories = await rows("categories?select=id&slug=eq.meal", token);
  check(categories.length === 1, "Meal category was not available");
  const plateId = await rpc("publish_plate", token, {
    p_category_id: categories[0].id, p_body: "Local concurrency fixture Plate",
    p_links: [], p_tags: [], p_attachment_ids: [],
  });
  const groupId = await rpc("create_group", token, { p_name: "Local concurrency test Table" });
  console.log("PASS: local concurrent fixture created");

  const shareRequestId = crypto.randomUUID();
  const shareArgs = { p_group_id: groupId, p_plate_id: plateId,
    p_client_request_id: shareRequestId, p_body: "Local concurrency fixture share",
    p_links: [], p_attachment_ids: [] };
  const shareIds = await Promise.all(Array.from({ length: 8 }, () => rpc("share_plate", token, shareArgs)));
  check(new Set(shareIds).size === 1, "Concurrent share retries returned different entries");
  const shareId = shareIds[0];
  const entries = await rows(`timeline_content?select=id&group_id=eq.${groupId}`, token);
  check(entries.length === 1 && entries[0].id === shareId, "Concurrent share retries created extra entries");
  const threads = await rows(`threads?select=id&root_entry_id=eq.${shareId}`, token);
  check(threads.length === 1, "Concurrent share retries created extra threads");
  console.log("PASS: eight simultaneous identical shares produced one entry and thread");

  const replyArgs = { p_thread_id: threads[0].id, p_client_request_id: crypto.randomUUID(),
    p_body: "Local concurrency fixture reply", p_links: [], p_attachment_ids: [] };
  const replyIds = await Promise.all(Array.from({ length: 8 }, () => rpc("reply_to_thread", token, replyArgs)));
  check(new Set(replyIds).size === 1, "Concurrent reply retries returned different replies");
  const replies = await rows(`reply_content?select=id&thread_id=eq.${threads[0].id}`, token);
  check(replies.length === 1 && replies[0].id === replyIds[0], "Concurrent reply retries created extra replies");
  console.log("PASS: eight simultaneous identical replies produced one reply");

  const saveArgs = { p_plate_id: plateId, p_expected_revision: 1,
    p_source_share_id: shareId, p_preview_asset_id: null };
  const saveIds = await Promise.all(Array.from({ length: 8 }, () => rpc("save_plate", token, saveArgs)));
  check(new Set(saveIds).size === 1, "Concurrent saves returned different reminders");
  const saves = await rows(`menu_plate_saves?select=id&plate_id=eq.${plateId}`, token);
  const sources = await rows(`menu_plate_sources?select=share_entry_id&save_id=eq.${saveIds[0]}`, token);
  check(saves.length === 1 && saves[0].id === saveIds[0]
    && sources.length === 1 && sources[0].share_entry_id === shareId,
  "Concurrent saves created extra reminders or sources");
  console.log("PASS: eight simultaneous identical saves produced one reminder and source");
}

try {
  await run();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local test error"}`);
  process.exitCode = 1;
}
