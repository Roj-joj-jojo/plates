import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const hostedAlphaOrigin = "https://magftiqtsfjfzihoajor.supabase.co";
const displayName = "Dinnerfolk Admin";

export async function createOwner(client, selectedEmail) {
  const email = selectedEmail.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter the selected owner email address");
  }
  const { data: existing, error: lookupError } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (lookupError || !Array.isArray(existing?.users)) throw new Error("Could not verify empty hosted Auth; stop and review");
  if (existing.users.length !== 0) throw new Error("Hosted Auth already contains an account; stop and review before creating anything");

  // One creation attempt only. Passwordless sign-in remains the app's login flow.
  // The generated password is never printed, returned to the caller or persisted.
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: randomBytes(32).toString("base64url"),
    email_confirm: false,
    user_metadata: { display_name: displayName },
  });
  if (error || !data?.user) throw new Error("Owner creation was not confirmed; inspect hosted Users before any retry");
  if (data.user.email?.toLowerCase() !== email
    || data.user.user_metadata?.display_name !== displayName || data.user.email_confirmed_at
    || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.user.id ?? "")) {
    throw new Error("Unexpected created-account result; inspect hosted Users before continuing");
  }
  return { created: true, confirmed: false };
}

export function ownerSetupFetch(input, options) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== hostedAlphaOrigin || url.pathname !== "/auth/v1/admin/users"
    || !["GET", "POST"].includes(options?.method ?? "GET")) {
    throw new Error("Unexpected setup destination or API operation");
  }
  return fetch(input, { ...options, redirect: "error" });
}

async function main() {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this helper interactively without arguments or piped credentials");
  }
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!hidden) process.stdout.write(chunk, encoding);
    done();
  } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  prompt.on("SIGINT", () => abort.abort());
  const ask = text => prompt.question(text, { signal: abort.signal });
  let email;
  let secret;
  try {
    email = await ask("Selected owner email: ");
    console.log(`Target: ${hostedAlphaOrigin}; display name: ${displayName}`);
    console.log("Creates one unconfirmed account in empty hosted Auth. No email send, owner grant or signup-setting change.");
    if (await ask("Type CREATE OWNER to proceed: ") !== "CREATE OWNER") throw new Error("Setup cancelled; no API request made");
    output.write("Supabase secret/service-role key (hidden; not saved): ");
    hidden = true;
    secret = await ask("");
  } finally {
    hidden = false;
    output.write("\n");
    prompt.close();
  }
  secret = secret.trim();
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secret)
    && !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret)) {
    throw new Error("Expected a backend secret/service-role key; no API request made");
  }
  const client = createClient(hostedAlphaOrigin, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: ownerSetupFetch },
  });
  await createOwner(client, email);
  console.log("PASS owner account created with Dinnerfolk Admin metadata; email remains unconfirmed.");
  console.log("Next: verify the real inbox, then separately activate owner access. Do not rerun this creation helper.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Never echo API responses, credentials, account data or upstream errors.
    console.error("Owner setup stopped or was not confirmed. No automatic retry/cleanup. If a creation request was sent, inspect hosted Users before continuing.");
    process.exitCode = 1;
  });
}
