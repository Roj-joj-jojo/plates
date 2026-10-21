// Local-only populated HTTP/RLS check. Run from the project root with
// node --env-file=.env.local supabase/tests/local_populated_http.mjs
// Creates two clearly labelled local Auth users and one lasting Plate, Table,
// share, reply and Menu save. No cleanup or remote request is performed.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const mail = "http://127.0.0.1:54324/api/v1";

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
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
}

async function rows(path, token) {
  const response = await api(`/rest/v1/${path}`, token);
  check(response.status === 200, `Read ${path.split("?")[0]} returned HTTP ${response.status}`);
  return response.json();
}

async function rpc(name, token, args) {
  const response = await api(`/rest/v1/rpc/${name}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  check(response.status === 200, `${name} returned HTTP ${response.status}`);
  return response.json();
}

async function newLocalAccount(label) {
  const email = `plates-local-${crypto.randomUUID()}@example.test`;
  const before = await getJson(`${mail}/messages`);
  const oldIds = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", null, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true, data: { display_name: label } }),
  });
  check(sent.status === 200, `Local ${label} code request returned HTTP ${sent.status}`);

  let messageId;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listing = await getJson(`${mail}/messages`);
    messageId = listing.messages.find((message) => !oldIds.has(message.ID)
      && message.To.length === 1 && message.To[0].Address === email)?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(messageId, `Local ${label} code did not arrive within 20 seconds`);
  const message = await getJson(`${mail}/message/${messageId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, `Local ${label} code email had no six-digit code`);
  const verified = await api("/auth/v1/verify", null, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verified.status === 200, `Local ${label} verification returned HTTP ${verified.status}`);
  const session = await verified.json();
  check(session.access_token, `Local ${label} session is missing`);
  return session.access_token;
}

async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const health = await api("/auth/v1/health", null);
  check(health.status === 200, `Local Auth health returned HTTP ${health.status}`);

  const owner = await newLocalAccount("Local HTTP test owner");
  const outsider = await newLocalAccount("Local HTTP test outsider");
  console.log("PASS: two local test accounts verified with in-memory codes");

  const categories = await rows("categories?select=id&slug=eq.meal", owner);
  check(categories.length === 1, "Meal category was not available");
  const categoryId = categories[0].id;
  const originalBody = "Local HTTP fixture: original Plate content";
  const revisedBody = "Local HTTP fixture: revised Plate content";
  const plateId = await rpc("publish_plate", owner, {
    p_category_id: categoryId, p_body: originalBody, p_links: [], p_tags: [], p_attachment_ids: [],
  });
  const groupId = await rpc("create_group", owner, { p_name: "Local HTTP test Table" });
  const requestId = crypto.randomUUID();
  const shareId = await rpc("share_plate", owner, {
    p_group_id: groupId, p_plate_id: plateId, p_client_request_id: requestId,
    p_body: "Local HTTP fixture share", p_links: [], p_attachment_ids: [],
  });
  const repeatedShare = await rpc("share_plate", owner, {
    p_group_id: groupId, p_plate_id: plateId, p_client_request_id: requestId,
    p_body: "Local HTTP fixture share", p_links: [], p_attachment_ids: [],
  });
  check(repeatedShare === shareId, "Identical share retry created a different entry");
  const threads = await rows(`threads?select=id&root_entry_id=eq.${shareId}`, owner);
  check(threads.length === 1, "Share did not create one discussion thread");
  const threadId = threads[0].id;
  const replyId = await rpc("reply_to_thread", owner, {
    p_thread_id: threadId, p_client_request_id: crypto.randomUUID(),
    p_body: "Local HTTP fixture reply", p_links: [], p_attachment_ids: [],
  });
  const replies = await rows(`reply_content?select=id&thread_id=eq.${threadId}`, owner);
  check(replies.length === 1 && replies[0].id === replyId, "Owner could not read the reply");
  console.log("PASS: owner publish, Table creation, idempotent share and reply");

  const saveId = await rpc("save_plate", owner, {
    p_plate_id: plateId, p_expected_revision: 1, p_source_share_id: shareId, p_preview_asset_id: null,
  });
  const saves = await rows(`menu_plate_saves?select=id,snapshot_body,snapshot_revision&id=eq.${saveId}`, owner);
  check(saves.length === 1 && saves[0].snapshot_body === originalBody && saves[0].snapshot_revision === 1,
    "Initial Menu snapshot was not captured");
  const sources = await rows(`menu_source_context?select=save_id,group_id,thread_id,source_available&save_id=eq.${saveId}`, owner);
  check(sources.length === 1 && sources[0].group_id === groupId
    && sources[0].thread_id === threadId && sources[0].source_available,
  "Owner could not resolve the exact saved discussion");
  const revision = await rpc("edit_plate", owner, {
    p_plate_id: plateId, p_expected_revision: 1, p_category_id: categoryId,
    p_body: revisedBody, p_links: [], p_tags: [], p_attachment_ids: [],
  });
  check(revision === 2, "Plate edit did not advance its revision");
  const [current] = await rows(`plates?select=body,revision&id=eq.${plateId}`, owner);
  const [frozen] = await rows(`menu_plate_saves?select=snapshot_body,snapshot_revision&id=eq.${saveId}`, owner);
  const [share] = await rows(`plate_shares?select=plate_revision_at_share&entry_id=eq.${shareId}`, owner);
  check(current.body === revisedBody && current.revision === 2
    && frozen.snapshot_body === originalBody && frozen.snapshot_revision === 1
    && share.plate_revision_at_share === 1,
  "Live Plate, share revision and frozen Menu snapshot diverged from the contract");
  console.log("PASS: saved discussion resolves; edit changes live Plate but not Menu snapshot");

  const visiblePlate = await rows(`plates?select=id,body&id=eq.${plateId}`, outsider);
  check(visiblePlate.length === 1 && visiblePlate[0].body === revisedBody,
    "Signed-in outsider could not read the public Plate");
  for (const path of [
    `groups?select=id&id=eq.${groupId}`,
    `timeline_content?select=id&group_id=eq.${groupId}`,
    `plate_shares?select=entry_id&entry_id=eq.${shareId}`,
    `threads?select=id&id=eq.${threadId}`,
    `reply_content?select=id&thread_id=eq.${threadId}`,
    `menu_plate_saves?select=id&id=eq.${saveId}`,
    `menu_source_context?select=save_id&save_id=eq.${saveId}`,
  ]) {
    const denied = await rows(path, outsider);
    check(denied.length === 0, `Outsider read a private ${path.split("?")[0]} row`);
  }
  const deniedReply = await api("/rest/v1/rpc/reply_to_thread", outsider, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_thread_id: threadId, p_client_request_id: crypto.randomUUID(),
      p_body: "Should be denied", p_links: [], p_attachment_ids: [] }),
  });
  check(deniedReply.status === 403, `Outsider reply returned HTTP ${deniedReply.status}`);
  console.log("PASS: outsider sees Plate but no Table, discussion or another saver's Menu; reply denied");
}

try {
  await run();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local test error"}`);
  process.exitCode = 1;
}
