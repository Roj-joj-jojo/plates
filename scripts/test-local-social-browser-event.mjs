// One retained synthetic message for the existing approved browser-test fixture.
import assert from "node:assert/strict";
import { readFile, appendFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createLocalErasureAdmin } from "./local-erasure-workflow.mjs";

assert.deepEqual(process.argv.slice(2), ["--approved-existing-fixture-message"]);
const journal = "/private/tmp/plates-social-http-WrkwP0/scope.jsonl";
const events = (await readFile(journal, "utf8")).trim().split("\n").map(line => JSON.parse(line));
const scope = events.find(event => event.event === "scope");
assert.equal(scope.run, "43e8c153-c175-48f0-a851-eaff9472064b");
assert(events.some(event => event.event === "passed"));
const peer = scope.accounts.find(account => account.label === "Peer");
const profile = events.find(event => event.event === "profile-ready" && event.label === "Peer");
const group = events.find(event => event.event === "table-created" && event.label === "main");
assert.equal(profile.profileId, "22fdcb4c-f882-4eed-bf2b-9a99b9e179dc");
assert.equal(group.groupId, "3631bf7a-7bc1-472f-9817-4035007747ce");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const admin = createLocalErasureAdmin();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: peer.email });
  assert(!linkError, "Local fixture sign-in refused");
  const { error: authError } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  assert(!authError, "Local fixture verification refused");
  const { data: own, error: ownError } = await client.from("my_profile").select("id").single();
  assert(!ownError && own.id === profile.profileId, "Wrong fixture identity");
  const { data: entryId, error } = await client.rpc("post_message", {
    p_group_id: group.groupId,
    p_client_request_id: "6e837d6d-d122-4e6f-922d-c76fe96a32cd",
    p_body: "Browser draft preservation test: this message arrived from a separate test session.",
  });
  assert(!error, `Fixture message refused (${error?.code ?? "unknown"})`);
  if (!events.some(event => event.event === "browser-message-created")) {
    await appendFile(journal, JSON.stringify({ event: "browser-message-created", entryId }) + "\n", { mode: 0o600 });
  }
  console.log("PASS: one idempotent retained browser-test message posted; no credentials printed.");
} catch {
  console.error("Browser fixture event failed; existing scope retained.");
  process.exitCode = 1;
} finally {
  await client.realtime.disconnect();
}
