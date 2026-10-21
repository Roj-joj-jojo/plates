// Local-only concurrency check. Leaves pending intents for a synthetic account;
// no cleanup or remote request occurs.
import { createClient } from "@supabase/supabase-js";

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
  check(sent.status === 200, `Local code request returned HTTP ${sent.status}`);
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
  check(emails.length > 0, "No synthetic local test account was found");
  const session = await sessionFor(emails[0]);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: sessionError } = await client.auth.setSession({
    access_token: session.access_token, refresh_token: session.refresh_token,
  });
  if (sessionError) throw sessionError;
  const { data: before, error: beforeError } = await client.from("media_upload_intents")
    .select("id, state, created_at");
  if (beforeError) throw beforeError;
  const now = Date.now();
  const hour = before.filter((row) => new Date(row.created_at).getTime() > now - 3600_000);
  const day = before.filter((row) => new Date(row.created_at).getTime() > now - 24 * 3600_000);
  const unfinished = hour.filter((row) => row.state === "pending" || row.state === "processing");
  const available = Math.min(6 - unfinished.length, 12 - hour.length, 60 - day.length);
  check(available >= 2, "Synthetic account lacks room for a meaningful concurrent test");
  const attempts = available + 3;
  const results = await Promise.all(Array.from({ length: attempts }, () => client.rpc("request_plate_upload")));
  const successes = results.filter((result) => !result.error);
  const limited = results.filter((result) => result.error?.code === "P0001");
  check(successes.length === available && limited.length === attempts - available,
    `Concurrent limit mismatch: ${successes.length} issued, ${limited.length} limited`);
  const ids = successes.map((result) => result.data?.[0]?.intent_id);
  check(ids.every(Boolean) && new Set(ids).size === ids.length, "Concurrent requests returned duplicate intents");
  console.log("PASS: concurrent requests stopped at the account upload cap");
}

try { await run(); }
catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "Unknown local rate-limit error"}`);
  process.exitCode = 1;
}
