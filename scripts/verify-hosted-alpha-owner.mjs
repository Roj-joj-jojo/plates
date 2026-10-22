import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { hostedAlphaOrigin } from "./create-hosted-alpha-owner.mjs";

function failure(stage, error) {
  const code = /^[a-z_]{1,48}$/.test(error?.code ?? "") ? ` (${error.code})` : "";
  return new Error(`${stage}${code}`);
}

export async function verifyOwnerInbox(client, selectedEmail, askCode) {
  const email = selectedEmail.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid selected owner email");
  // Admin-created unconfirmed accounts need confirmation, not the returning-
  // user OTP route (which enters signup and fails while signup is disabled).
  const { error: sendError } = await client.auth.resend({ email, type: "signup" });
  if (sendError) throw failure("Code request failed; stop and review", sendError);
  const token = (await askCode()).trim();
  if (!/^[0-9]{6}$/.test(token)) throw new Error("Expected six digits; no verification request sent");
  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw failure("Code verification failed; stop and review", error);
  // A returned session is never printed or saved. Revoke this helper's refresh
  // session even if subsequent identity validation fails.
  const hasSession = Boolean(data?.session?.access_token);
  try {
    if (!hasSession || data.user?.email?.toLowerCase() !== email || !data.user.email_confirmed_at
      || data.user.user_metadata?.display_name !== "Dinnerfolk Admin") {
      throw new Error("Unexpected verified owner result; stop and inspect hosted Users");
    }
  } finally {
    if (hasSession) {
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) throw failure("Verification returned a session but sign-out was not confirmed", signOutError);
    }
  }
  return { verified: true, signedOut: true };
}

export function ownerVerificationFetch(input, options) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const expectedMethod = {
    "/auth/v1/resend": "POST", "/auth/v1/verify": "POST",
    "/auth/v1/logout": "POST", "/auth/v1/user": "GET",
  }[url.pathname];
  if (url.origin !== hostedAlphaOrigin || !expectedMethod || (options?.method ?? "GET") !== expectedMethod) {
    throw new Error("Unexpected owner-verification destination or API operation");
  }
  return fetch(input, { ...options, redirect: "error" });
}

async function main() {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Interactive use only; no arguments");
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!hidden) process.stdout.write(chunk, encoding);
    done();
  } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  prompt.on("SIGINT", () => abort.abort());
  const ask = text => prompt.question(text, { signal: abort.signal });
  async function askHidden(label) {
    output.write(label);
    hidden = true;
    try { return await ask(""); }
    finally { hidden = false; output.write("\n"); }
  }
  try {
    const email = await ask("Existing owner email: ");
    const key = (await askHidden("Supabase publishable key (not the secret key): ")).trim();
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error("Use the project's sb_publishable_ key");
    console.log(`Target: ${hostedAlphaOrigin}. Sends one code to the existing account; creates no account or owner grant.`);
    if (await ask("Type SEND CODE to proceed: ") !== "SEND CODE") throw new Error("Cancelled before sending");
    const client = createClient(hostedAlphaOrigin, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: ownerVerificationFetch },
    });
    await verifyOwnerInbox(client, email, () => askHidden("Enter the six-digit email code (hidden): "));
    console.log("PASS owner inbox verified by email code; temporary helper session signed out.");
    console.log("Owner privileges not activated; public signup settings unchanged. No credentials/session written to disk.");
  } finally {
    hidden = false;
    prompt.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // These errors are fixed local labels or sanitised code-only diagnostics.
    const safe = /^(Code request failed|Code verification failed|Verification returned a session)/.test(error?.message ?? "");
    console.error(safe ? error.message : "Owner verification stopped or was not confirmed; no automatic resend/retry. Do not share keys or codes.");
    process.exitCode = 1;
  });
}
