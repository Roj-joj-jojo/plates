import assert from "node:assert/strict";
import { authErrorMessage, displayNameProblem } from "../src/lib/account-ux.ts";

for (const mode of ["signup", "signin"]) {
  for (const upstream of [new Error("INTERNAL_DETAIL_PLACEHOLDER"), { code: "unexpected_failure", message: "INTERNAL_DETAIL_PLACEHOLDER" }, null]) {
    const message = authErrorMessage(upstream, mode);
    assert.ok(!message.includes("INTERNAL_DETAIL_PLACEHOLDER"), "never reflect upstream internals");
    assert.ok(!message.includes("Database error"), "do not expose database implementation");
  }
  assert.match(authErrorMessage({ status: 429 }, mode), /Wait a few minutes/);
  assert.match(authErrorMessage({ code: "over_email_send_rate_limit" }, mode), /Too many attempts/);
  assert.match(authErrorMessage({ name: "AuthRetryableFetchError" }, mode), /connection/);
  assert.match(authErrorMessage({ code: "otp_expired" }, mode, true), /request a new code/);
}
assert.match(authErrorMessage({ code: "signup_disabled" }, "signin"), /Create account/);
assert.match(authErrorMessage({ code: "unexpected_failure" }, "signup"), /approved/);
assert.match(authErrorMessage({ code: "email_address_invalid" }, "signup"), /valid email/);
assert.equal(displayNameProblem("   "), "Enter a display name.");
assert.equal(displayNameProblem("A".repeat(80)), null);
assert.match(displayNameProblem("A".repeat(81)), /80/);
assert.equal(displayNameProblem("🍜".repeat(80)), null, "count Unicode characters consistently with database char_length");
assert.match(displayNameProblem("🍜".repeat(81)), /80/);
assert.equal(displayNameProblem("  Alex 🍜  "), null);
assert.match(displayNameProblem("Alex\nName"), /line breaks/);
assert.match(displayNameProblem("Alex\u0000Name"), /control/);
console.log("PASS Account UX: safe auth errors, rate/connection/code guidance and display-name Unicode/blank/control limits (offline)");
