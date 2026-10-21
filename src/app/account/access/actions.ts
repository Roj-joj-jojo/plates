"use server";

import { revalidatePath } from "next/cache";
import { createActionClient } from "@/lib/supabase/server";

async function ownerClient() {
  const client = await createActionClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Sign in required");
  const { data, error: statusError } = await client.rpc("app_access_status");
  if (statusError || data?.can_manage !== true) throw new Error("Owner required");
  return client;
}

export async function allowEmail(email: string) {
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, message: "Enter a valid email address." };
  }
  try {
    const client = await ownerClient();
    const { error } = await client.rpc("allow_signup_email", { p_email: email.trim() });
    if (error) return { ok: false, message: error.code === "23514"
      ? "This address is invalid or already has an account. Existing accounts can sign in normally."
      : "Could not allow this address. Please try again." };
    revalidatePath("/account/access");
    return { ok: true, message: "They can now create an account with this email address." };
  } catch { return { ok: false, message: "Allowlist management is unavailable. Please sign in again." }; }
}

export async function withdrawEmail(id: string) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Choose an allowlist entry." };
  }
  try {
    const client = await ownerClient();
    const { error } = await client.rpc("withdraw_signup_email", { p_id: id });
    if (error) throw new Error("Withdrawal unavailable");
    revalidatePath("/account/access");
    return { ok: true, message: "Permission withdrawn. Existing accounts are unaffected." };
  } catch { return { ok: false, message: "Could not withdraw permission. Please try again." }; }
}
