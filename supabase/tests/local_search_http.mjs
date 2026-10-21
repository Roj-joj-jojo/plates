// Local-only search HTTP/rendering check. Reuses synthetic Request accounts;
// creates fresh local code emails/sessions but no content records.
// Run: node --env-file=.env.local supabase/tests/local_search_http.mjs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const app = "http://127.0.0.1:3000";
const mail = "http://127.0.0.1:54324/api/v1";

function check(condition, message) { if (!condition) throw new Error(message); }
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
async function sessionFor(email) {
  const before = await json(`${mail}/messages`);
  const oldIds = new Set(before.messages.map((message) => message.ID));
  const sent = await api("/auth/v1/otp", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: false }),
  });
  check(sent.status === 200, `Existing local account code request returned HTTP ${sent.status}`);
  let messageId;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listing = await json(`${mail}/messages`);
    messageId = listing.messages.find((message) => !oldIds.has(message.ID)
      && message.To.length === 1 && message.To[0].Address === email)?.ID;
    if (messageId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(messageId, "Fresh local code did not arrive");
  const message = await json(`${mail}/message/${messageId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, "Fresh local code was missing");
  const verified = await api("/auth/v1/verify", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verified.status === 200, `Local code verification returned HTTP ${verified.status}`);
  const session = await verified.json();
  check(session.access_token && session.refresh_token, "Local session was incomplete");
  return session;
}
async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const listing = await json(`${mail}/messages`);
  const emails = [...new Set(listing.messages.flatMap((message) => message.To.map((to) => to.Address)))
    .values()].filter((email) => /^plates-request-[a-f0-9-]+@example\.test$/.test(email));
  check(emails.length >= 2, "Existing synthetic Request accounts were not found");
  const accounts = [];
  for (const email of emails.slice(0, 2)) {
    const session = await sessionFor(email);
    const groups = await rows("groups?select=id,name&name=eq.Local%20Request%20test%20Table", session.access_token);
    accounts.push({ session, groups });
  }
  const owner = accounts.find((account) => account.groups.length === 1);
  const outsider = accounts.find((account) => account.groups.length === 0);
  check(owner && outsider, "Could not distinguish the Request owner and outsider");
  const groupId = owner.groups[0].id;
  const [request] = await rows(`timeline_content?select=id&group_id=eq.${groupId}&kind=eq.request&limit=1`,
    owner.session.access_token);
  check(request, "Existing local Request fixture was not found");

  const plateRows = await rows("plates?select=id,body&availability=eq.available&limit=50", owner.session.access_token);
  const plate = plateRows.find((item) => typeof item.body === "string" && item.body.length >= 8);
  check(plate, "No searchable local Plate was found");
  const plateTerm = plate.body.slice(0, 8);
  const plateHits = await rpc("search_plates", owner.session.access_token, { p_query: plateTerm });
  check(plateHits.some((item) => item.id === plate.id), "Accessible Plate search missed an existing Plate");
  const tableHits = await rpc("search_table", owner.session.access_token,
    { p_group_id: groupId, p_query: "corner café" });
  check(tableHits.some((item) => item.kind === "reply" && item.entry_id === request.id),
    "Table reply search missed its discussion");
  const menuHits = await rpc("search_menu", owner.session.access_token,
    { p_query: "Which café should we try?" });
  check(menuHits.some((item) => item.save_type === "request"), "Saved Request search missed the live question");
  console.log("PASS: real local session finds accessible Plate, Table reply and saved Request");

  const denied = await api("/rest/v1/rpc/search_table", outsider.session.access_token, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_group_id: groupId, p_query: "corner café" }),
  });
  check(denied.status === 403, `Non-member Table search returned HTTP ${denied.status}`);
  const noMenu = await rpc("search_menu", outsider.session.access_token,
    { p_query: "Which café should we try?" });
  check(noMenu.length === 0, "Non-member searched another person's Menu");
  const anon = await api("/rest/v1/rpc/search_plates", null, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_query: plateTerm }),
  });
  check(anon.status === 401 || anon.status === 403, `Anonymous search returned HTTP ${anon.status}`);
  console.log("PASS: non-member Table/Menu search and anonymous search denied");

  const cookieName = `sb-${parsed.hostname.split(".")[0]}-auth-token`;
  async function page(path, session) {
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    return fetch(`${app}${path}`, {
      headers: { Cookie: `${cookieName}=${cookieValue}` }, redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
  }
  const platePage = await page(`/search?q=${encodeURIComponent(plateTerm)}`, owner.session);
  const tablePage = await page(`/tables/${groupId}/search?q=${encodeURIComponent("corner café")}`, owner.session);
  const menuPage = await page(`/menu?q=${encodeURIComponent("Which café should we try?")}`, owner.session);
  check(platePage.status === 200 && (await platePage.text()).includes("Open Plate"),
    `Plate search page returned HTTP ${platePage.status}`);
  check(tablePage.status === 200 && (await tablePage.text()).includes("Discussion reply"),
    `Table search page returned HTTP ${tablePage.status}`);
  check(menuPage.status === 200 && (await menuPage.text()).includes("Saved Request"),
    `Menu search page returned HTTP ${menuPage.status}`);
  const hidden = await page(`/tables/${groupId}/search?q=${encodeURIComponent("corner café")}`, outsider.session);
  check(hidden.status === 404, `Non-member Table search page returned HTTP ${hidden.status}`);
  console.log("PASS: search pages render matching content and hide private Table search");
}
try { await run(); } catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local test error"}`);
  process.exitCode = 1;
}
