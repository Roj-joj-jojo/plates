// Local-only Auth, HTTP and rendered Request flow. Creates labelled, lasting
// synthetic accounts/records; no deletion, hosted request or secret output.
// Run: node --env-file=.env.local supabase/tests/local_requests_http.mjs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const app = "http://127.0.0.1:3000";
const mail = "http://127.0.0.1:54324/api/v1";

function check(condition, message) {
  if (!condition) throw new Error(message);
}
async function json(address) {
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
async function rows(path, token) {
  const response = await api(`/rest/v1/${path}`, token);
  check(response.status === 200, `Read ${path.split("?")[0]} returned HTTP ${response.status}`);
  return response.json();
}
async function rpc(name, token, args) {
  const response = await api(`/rest/v1/rpc/${name}`, token, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  check(response.status === 200, `${name} returned HTTP ${response.status}`);
  return response.json();
}
async function newLocalAccount(label) {
  const email = `plates-request-${crypto.randomUUID()}@example.test`;
  const before = await json(`${mail}/messages`);
  const oldIds = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true, data: { display_name: label } }),
  });
  check(sent.status === 200, `Local ${label} code request returned HTTP ${sent.status}`);
  let messageId;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listing = await json(`${mail}/messages`);
    messageId = listing.messages.find((message) => !oldIds.has(message.ID)
      && message.To.length === 1 && message.To[0].Address === email)?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(messageId, `Local ${label} code did not arrive`);
  const message = await json(`${mail}/message/${messageId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, `Local ${label} code email had no six-digit code`);
  const verified = await api("/auth/v1/verify", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verified.status === 200, `Local ${label} verification returned HTTP ${verified.status}`);
  const session = await verified.json();
  check(session.access_token && session.refresh_token, `Local ${label} session is incomplete`);
  return session;
}
async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const health = await api("/auth/v1/health", null);
  check(health.status === 200, `Local Auth health returned HTTP ${health.status}`);
  const owner = await newLocalAccount("Local Request test asker");
  const outsider = await newLocalAccount("Local Request test outsider");
  console.log("PASS: local Request test accounts verified with in-memory codes");

  const groupId = await rpc("create_group", owner.access_token, { p_name: "Local Request test Table" });
  const requestKey = crypto.randomUUID();
  const args = { p_group_id: groupId, p_client_request_id: requestKey,
    p_question: "Which café should we try?", p_context: "Looking for a quiet lunch spot",
    p_links: [], p_attachment_ids: [] };
  const requestId = await rpc("post_table_request", owner.access_token, args);
  check(await rpc("post_table_request", owner.access_token, args) === requestId,
    "Identical Request retry made a different root");
  const [detail] = await rows(`requests?select=entry_id,question&entry_id=eq.${requestId}`, owner.access_token);
  const [thread] = await rows(`threads?select=id,root_kind&root_entry_id=eq.${requestId}`, owner.access_token);
  check(detail?.question === args.p_question && thread?.root_kind === "request",
    "Request detail or dedicated thread was missing");
  await rpc("reply_to_thread", owner.access_token, { p_thread_id: thread.id,
    p_client_request_id: crypto.randomUUID(), p_body: "The corner café looks good",
    p_links: [], p_attachment_ids: [] });
  const saveId = await rpc("save_table_request", owner.access_token, { p_request_entry_id: requestId });
  check(await rpc("save_table_request", owner.access_token, { p_request_entry_id: requestId }) === saveId,
    "Repeat save made another Menu item");
  const [saved] = await rows(`menu_request_context?select=save_id,question,thread_id,source_available&save_id=eq.${saveId}`, owner.access_token);
  check(saved?.question === args.p_question && saved.thread_id === thread.id && saved.source_available,
    "Menu did not resolve the current discussion");
  console.log("PASS: Request posting, retry, reply and live Menu save");

  for (const path of [
    `groups?select=id&id=eq.${groupId}`, `timeline_content?select=id&id=eq.${requestId}`,
    `requests?select=entry_id&entry_id=eq.${requestId}`,
    `threads?select=id&id=eq.${thread.id}`,
    `reply_content?select=id&thread_id=eq.${thread.id}`,
    `menu_request_saves?select=id&id=eq.${saveId}`,
    `menu_request_context?select=save_id&save_id=eq.${saveId}`,
  ]) {
    check((await rows(path, outsider.access_token)).length === 0,
      `Outsider read private ${path.split("?")[0]} data`);
  }
  for (const [name, args] of [
    ["save_table_request", { p_request_entry_id: requestId }],
    ["reply_to_thread", { p_thread_id: thread.id, p_client_request_id: crypto.randomUUID(),
      p_body: "Not a member", p_links: [], p_attachment_ids: [] }],
  ]) {
    const denied = await api(`/rest/v1/rpc/${name}`, outsider.access_token, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args),
    });
    check(denied.status === 403, `Outsider ${name} returned HTTP ${denied.status}`);
  }
  console.log("PASS: non-member Request, replies and Menu are private; writes denied");

  const cookieName = `sb-${parsed.hostname.split(".")[0]}-auth-token`;
  async function page(path, session) {
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    return fetch(`${app}${path}`, {
      headers: { Cookie: `${cookieName}=${cookieValue}` }, redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
  }
  const tablePage = await page(`/tables/${groupId}`, owner);
  const requestPage = await page(`/tables/${groupId}/requests/${requestId}`, owner);
  const menuPage = await page("/menu", owner);
  check(tablePage.status === 200 && (await tablePage.text()).includes("Which café should we try?"),
    `Owner Table rendering returned HTTP ${tablePage.status}`);
  check(requestPage.status === 200 && (await requestPage.text()).includes("The corner café looks good"),
    `Owner Request rendering returned HTTP ${requestPage.status}`);
  check(menuPage.status === 200 && (await menuPage.text()).includes("Open current discussion"),
    `Owner Menu rendering returned HTTP ${menuPage.status}`);
  const hiddenPage = await page(`/tables/${groupId}/requests/${requestId}`, outsider);
  check(hiddenPage.status === 404, `Non-member Request page returned HTTP ${hiddenPage.status}`);
  console.log("PASS: signed-in Table, Request and Menu render; non-member Request page is hidden");
}
try { await run(); } catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local test error"}`);
  process.exitCode = 1;
}
