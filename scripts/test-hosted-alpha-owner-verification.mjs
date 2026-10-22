import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyOwnerInbox, ownerVerificationFetch } from "./verify-hosted-alpha-owner.mjs";
import { hostedAlphaOrigin } from "./create-hosted-alpha-owner.mjs";
import { createClient } from "@supabase/supabase-js";

// Offline: synthetic Auth replies only. No real keys, emails or OTP requests.
execFileSync(process.execPath, ["--check", fileURLToPath(new URL("./verify-hosted-alpha-owner.mjs", import.meta.url))], { stdio: "pipe" });
const email = "owner@example.test";
let calls = [];
let sendError = null;
let verifyError = null;
let signOutError = null;
let replyEmail = email;
const client = { auth: {
  async signInWithOtp() { assert.fail("Unconfirmed owner must not enter the signup-disabled OTP route"); },
  async resend(attributes) {
    calls.push("send");
    assert.deepEqual(attributes, { email, type: "signup" });
    return { error: sendError };
  },
  async verifyOtp(attributes) {
    calls.push("verify");
    assert.deepEqual(attributes, { email, token: "123456", type: "email" });
    return { error: verifyError, data: { session: { access_token: "synthetic-session" }, user: {
      email: replyEmail, email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { display_name: "Dinnerfolk Admin" },
    } } };
  },
  async signOut(options) { calls.push("signout"); assert.deepEqual(options, { scope: "local" }); return { error: signOutError }; },
} };
assert.deepEqual(await verifyOwnerInbox(client, " OWNER@example.test ", async () => "123456"), { verified: true, signedOut: true });
assert.deepEqual(calls, ["send", "verify", "signout"]);
calls = [];
sendError = { code: "over_email_send_rate_limit", message: "SYNTHETIC_PRIVATE_UPSTREAM" };
await assert.rejects(verifyOwnerInbox(client, email, () => assert.fail("must not ask for code")),
  error => error.message.includes(sendError.code) && !error.message.includes(sendError.message));
assert.deepEqual(calls, ["send"]);
sendError = null;
calls = [];
await assert.rejects(verifyOwnerInbox(client, email, async () => "bad-code"), /six digits/);
assert.deepEqual(calls, ["send"]);
calls = [];
verifyError = { code: "otp_expired" };
await assert.rejects(verifyOwnerInbox(client, email, async () => "123456"), /otp_expired/);
assert.deepEqual(calls, ["send", "verify"]);
verifyError = null;
calls = [];
replyEmail = "other@example.test";
await assert.rejects(verifyOwnerInbox(client, email, async () => "123456"), /Unexpected verified owner/);
assert.deepEqual(calls, ["send", "verify", "signout"]);
replyEmail = email;
signOutError = { code: "unexpected_failure" };
await assert.rejects(verifyOwnerInbox(client, email, async () => "123456"), /sign-out was not confirmed/);

const originalFetch = globalThis.fetch;
let requests = 0;
try {
  globalThis.fetch = async (input, options) => {
    requests += 1;
    assert.equal(new URL(input).origin, hostedAlphaOrigin);
    assert.equal(options.redirect, "error");
    return new Response("{}", { status: 200 });
  };
  assert.throws(() => ownerVerificationFetch("https://example.test/auth/v1/resend", { method: "POST" }), /destination/);
  assert.throws(() => ownerVerificationFetch(`${hostedAlphaOrigin}/auth/v1/otp`, { method: "POST" }), /operation/);
  assert.throws(() => ownerVerificationFetch(`${hostedAlphaOrigin}/auth/v1/admin/users`, { method: "POST" }), /operation/);
  assert.throws(() => ownerVerificationFetch(`${hostedAlphaOrigin}/auth/v1/user`, { method: "PUT" }), /operation/);
  assert.equal(requests, 0);
  for (const path of ["resend", "verify", "logout"]) await ownerVerificationFetch(`${hostedAlphaOrigin}/auth/v1/${path}`, { method: "POST" });
  assert.equal(requests, 3);
} finally { globalThis.fetch = originalFetch; }

// Exercise the installed real SDK against a fake HTTP transport, rather than
// relying only on method stubs. Any signup/OTP/admin endpoint is rejected.
const paths = [];
try {
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, hostedAlphaOrigin);
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    paths.push(url.pathname);
    let response = {};
    if (url.pathname === "/auth/v1/resend") {
      const body = JSON.parse(options.body);
      assert.equal(body.email, email);
      assert.equal(body.type, "signup");
    } else if (url.pathname === "/auth/v1/verify") {
      const body = JSON.parse(options.body);
      assert.equal(body.email, email);
      assert.equal(body.type, "email");
      response = { access_token: "synthetic.session.token", refresh_token: "synthetic-refresh",
        expires_in: 3600, token_type: "bearer", user: { id: "synthetic-owner", email,
          email_confirmed_at: "2026-01-01T00:00:00Z", user_metadata: { display_name: "Dinnerfolk Admin" } } };
    } else if (url.pathname === "/auth/v1/logout") {
      assert.equal(url.searchParams.get("scope"), "local");
    } else { assert.fail(`Unexpected SDK request path: ${url.pathname}`); }
    return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const sdk = createClient(hostedAlphaOrigin, "sb_publishable_SYNTHETIC_TEST_ONLY", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: ownerVerificationFetch },
  });
  assert.deepEqual(await verifyOwnerInbox(sdk, email, async () => "123456"), { verified: true, signedOut: true });
  assert.deepEqual(paths, ["/auth/v1/resend", "/auth/v1/verify", "/auth/v1/logout"]);
} finally { globalThis.fetch = originalFetch; }
console.log("PASS offline inbox verification: existing-account confirmation resend, failure/no-retry handling, verified identity, session sign-out and fixed destination.");
console.log("PASS installed SDK transport: confirmation resend, verification and local sign-out; no signup, OTP-login or admin request.");
console.log("Helper syntax passed. No real credentials, code send, database, worker or Git operation used.");
