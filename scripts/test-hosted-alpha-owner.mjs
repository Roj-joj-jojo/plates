import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createOwner, hostedAlphaOrigin, ownerSetupFetch } from "./create-hosted-alpha-owner.mjs";

// Entirely offline: injected Auth stubs and a blocked/stubbed fetch only.
const email = "owner@example.test";
let creations = [];
let existing = [];
let createError = null;
const client = { auth: { admin: {
  async listUsers(options) {
    assert.deepEqual(options, { page: 1, perPage: 1 });
    return { data: { users: existing }, error: null };
  },
  async createUser(attributes) {
    creations.push(attributes);
    return { data: { user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: attributes.email, user_metadata: attributes.user_metadata, email_confirmed_at: null,
    } }, error: createError };
  },
} } };
execFileSync(process.execPath, ["--check", fileURLToPath(new URL("./create-hosted-alpha-owner.mjs", import.meta.url))],
  { stdio: "pipe" });
assert.deepEqual(await createOwner(client, " OWNER@example.test "), { created: true, confirmed: false });
assert.equal(creations.length, 1);
assert.equal(creations[0].email, email);
assert.equal(creations[0].email_confirm, false);
assert.deepEqual(creations[0].user_metadata, { display_name: "Dinnerfolk Admin" });
assert.equal(creations[0].password.length, 43);
const firstPassword = creations[0].password;
await createOwner(client, email);
assert.notEqual(creations[1].password, firstPassword);

existing = [{ id: "existing-synthetic-account" }];
const before = creations.length;
await assert.rejects(createOwner(client, email), /already contains/);
assert.equal(creations.length, before);
await assert.rejects(createOwner(client, "invalid"), /email address/);
existing = [];
createError = { message: "SYNTHETIC_UPSTREAM_SECRET_MUST_NOT_BE_ECHOED" };
await assert.rejects(createOwner(client, email), error => !error.message.includes(createError.message));
assert.equal(creations.length, before + 1, "failed creation has no automatic retry");
await assert.rejects(createOwner({ auth: { admin: { async listUsers() {
  return { data: null, error: new Error("synthetic lookup failure") };
} } } }, email), /verify empty/);

const originalFetch = globalThis.fetch;
let requests = 0;
try {
  globalThis.fetch = async (input, options) => {
    requests += 1;
    assert.equal(new URL(input).origin, hostedAlphaOrigin);
    assert.equal(options.redirect, "error");
    return new Response("{}", { status: 200 });
  };
  assert.throws(() => ownerSetupFetch("https://example.test/auth/v1/admin/users"), /destination/);
  assert.throws(() => ownerSetupFetch(`${hostedAlphaOrigin}/auth/v1/admin/users`, { method: "DELETE" }), /operation/);
  assert.throws(() => ownerSetupFetch(`${hostedAlphaOrigin}/rest/v1/profiles`), /operation/);
  assert.equal(requests, 0);
  await ownerSetupFetch(`${hostedAlphaOrigin}/auth/v1/admin/users?page=1&per_page=1`, { method: "GET" });
  await ownerSetupFetch(`${hostedAlphaOrigin}/auth/v1/admin/users`, { method: "POST" });
  assert.equal(requests, 2);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("PASS offline owner setup: metadata, unconfirmed creation, existing-account refusal, no retry, fixed destination and redirect denial.");
console.log("Helper syntax passed. No hosted/local database, real credentials, email, worker or Git operation used.");
