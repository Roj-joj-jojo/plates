// Local-only rendered Plate edit visibility check. Reuses synthetic accounts
// from local_populated_http.mjs; creates only fresh local code emails/sessions.
// Run: node --env-file=.env.local supabase/tests/local_plate_editor_http.mjs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const app = "http://127.0.0.1:3000";
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
  for (let attempt = 0; attempt < 20; attempt += 1) {
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

async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  const parsed = new URL(url);
  check(parsed.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname),
    "This check only runs against loopback Supabase over HTTP");
  const listing = await getJson(`${mail}/messages`);
  const emails = [...new Set(listing.messages.flatMap((message) => message.To.map((to) => to.Address)))
    .values()].filter((email) => /^plates-local-[a-f0-9-]+@example\.test$/.test(email));
  check(emails.length >= 2, "Two synthetic local test accounts were not found");

  const accounts = [];
  for (const email of emails.slice(0, 2)) {
    const session = await sessionFor(email);
    check(session.access_token && session.refresh_token, "Local session was incomplete");
    const profileResponse = await api("/rest/v1/my_profile?select=id", session.access_token);
    check(profileResponse.status === 200, `Own profile view returned HTTP ${profileResponse.status}`);
    const profiles = await profileResponse.json();
    check(profiles.length === 1, "Own profile view did not return exactly one row");
    const platesResponse = await api(`/rest/v1/plates?select=id&author_id=eq.${profiles[0].id}&limit=1`, session.access_token);
    check(platesResponse.status === 200, `Own Plate read returned HTTP ${platesResponse.status}`);
    accounts.push({ session, plates: await platesResponse.json() });
  }
  const owner = accounts.find((account) => account.plates.length === 1);
  const outsider = accounts.find((account) => account.plates.length === 0);
  check(owner && outsider, "Could not distinguish the synthetic owner and outsider");
  const plateId = owner.plates[0].id;
  const cookieName = `sb-${parsed.hostname.split(".")[0]}-auth-token`;
  async function plateHtml(session) {
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    const response = await fetch(`${app}/feed/${plateId}`, {
      headers: { Cookie: `${cookieName}=${cookieValue}` },
      redirect: "manual", signal: AbortSignal.timeout(10000),
    });
    check(response.status === 200, `Rendered Plate returned HTTP ${response.status}`);
    return response.text();
  }
  const ownerHtml = await plateHtml(owner.session);
  const outsiderHtml = await plateHtml(outsider.session);
  check(ownerHtml.includes("Edit your Plate") && ownerHtml.includes("Save changes"),
    "Author-only editor did not render for the Plate author");
  check(!outsiderHtml.includes("Edit your Plate") && !outsiderHtml.includes("Save changes"),
    "Plate editor rendered for a non-author");
  console.log("PASS: local author sees Plate editor; signed-in non-author does not");
}

try {
  await run();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local test error"}`);
  process.exitCode = 1;
}
