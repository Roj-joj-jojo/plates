// Local-only Auth and HTTP smoke check. Run from the project root with
// node --env-file=.env.local supabase/tests/local_auth_http.mjs
// Requires the local app, Supabase and Mailpit to be running. It sends and
// consumes one local email code; it creates no permanent application fixture.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const app = "http://127.0.0.1:3000";
const mail = "http://127.0.0.1:54324/api/v1";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(address, options = {}) {
  const response = await fetch(address, {
    ...options,
    signal: AbortSignal.timeout(8000),
  });
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
    signal: AbortSignal.timeout(8000),
  });
}

async function run() {
  check(url && key, "Local Supabase URL or publishable key is missing");
  check(
    ["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname),
    "This test only runs against local Supabase",
  );

  const signedOutPage = await fetch(`${app}/account`, {
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  check(
    signedOutPage.status === 307 && signedOutPage.headers.get("location") === "/signin",
    "Account did not redirect to Sign in without a cookie",
  );

  const relations = [
    "profiles", "groups", "group_memberships", "membership_periods",
    "profile_directory", "categories", "plates", "timeline_entries",
    "plate_shares", "threads", "thread_replies", "timeline_content",
    "reply_content", "menu_plate_saves", "menu_plate_sources",
    "menu_source_context",
  ];
  for (const relation of relations) {
    const response = await api(`/rest/v1/${relation}?select=*&limit=1`, key);
    check(response.status === 401, `Anonymous read of ${relation} returned HTTP ${response.status}`);
  }
  console.log(`PASS: signed-out Account redirect and ${relations.length} anonymous relation denials`);

  const before = await getJson(`${mail}/messages`);
  check(before.total > 0 && before.total === before.messages.length, "Local mailbox is empty or paginated");
  const addresses = new Set(
    before.messages.flatMap((message) => message.To.map((recipient) => recipient.Address)),
  );
  check(addresses.size === 1, "Local mailbox has multiple recipients; choose a dedicated test mailbox");
  const [email] = addresses;
  const oldIds = new Set(before.messages.map((message) => message.ID));

  const send = await api("/auth/v1/otp", null, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: false }),
  });
  check(send.status === 200, `Local code request returned HTTP ${send.status}`);

  let newId;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const listing = await getJson(`${mail}/messages`);
    newId = listing.messages.find(
      (message) => !oldIds.has(message.ID) && message.To.length === 1 &&
        message.To[0].Address === email,
    )?.ID;
    if (newId) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check(newId, "New local code email did not arrive within 15 seconds");
  const message = await getJson(`${mail}/message/${newId}`);
  const code = message.HTML.match(/<strong>\s*([0-9]{6})\s*<\/strong>/)?.[1];
  check(code, "Local code email did not contain the expected six-digit code");

  const verification = await api("/auth/v1/verify", null, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });
  check(verification.status === 200, `Local code verification returned HTTP ${verification.status}`);
  const session = await verification.json();
  check(session.access_token && session.refresh_token, "Auth did not return a complete session");

  const user = await api("/auth/v1/user", session.access_token);
  check(user.status === 200, `Authenticated user check returned HTTP ${user.status}`);
  const identity = await user.json();
  check(identity.email === email, "Authenticated user does not match the local mailbox");

  const allowed = await api("/rest/v1/profiles?select=id,display_name&limit=2", session.access_token);
  check(allowed.status === 200, `Allowed profile read returned HTTP ${allowed.status}`);
  check((await allowed.json()).length >= 1, "Authenticated profile read returned no rows");
  const privateField = await api("/rest/v1/profiles?select=state&limit=1", session.access_token);
  check(privateField.status === 403, `Private profile field returned HTTP ${privateField.status}`);
  console.log("PASS: local code, Auth user, permitted profile and private-column denial");

  const cookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const account = await fetch(`${app}/account`, {
    headers: { Cookie: `${cookieName}=${cookieValue}` },
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  check(account.status === 200, `Authenticated Account returned HTTP ${account.status}`);
  const html = await account.text();
  check(html.includes("Signed in as") && html.includes("Sign out"), "Account content was missing");
  console.log("PASS: authenticated Account page");
}

try {
  await run();
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local test error"}`);
  process.exitCode = 1;
}
