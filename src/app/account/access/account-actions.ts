"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createActionClient } from "@/lib/supabase/server";
import { createLocalErasureAdmin, openLocalErasureStore, requestAdminRecordedErasure } from "../../../../scripts/local-erasure-workflow.mjs";
import { startAdminErasureWorker } from "../../../../scripts/start-admin-erasure-worker.mjs";

export type DeletionScope = {
  profile_id: string; email: string;
  impact: Record<string, number | { id: string; name: string; other_active_members: number }[]>;
};
const validId = (value: string) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fingerprint = (scope: DeletionScope) => createHash("sha256").update(JSON.stringify(scope)).digest("hex");

async function owner() {
  const client = await createActionClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Sign in required");
  const { data, error: statusError } = await client.rpc("app_access_status");
  if (statusError || data?.can_manage !== true) throw new Error("Owner required");
  return { client, user };
}

export async function previewAccountDeletion(profileId: string) {
  try {
    if (!validId(profileId)) throw new Error("Invalid account");
    const { client } = await owner();
    const { data, error } = await client.rpc("admin_account_deletion_scope", { p_profile_id: profileId });
    if (error || !data) throw new Error("Preview unavailable");
    const scope = data as DeletionScope;
    return { scope, fingerprint: fingerprint(scope) };
  } catch { return { message: "Could not load this account’s deletion details. Refresh and try again." }; }
}

export async function deleteManagedAccount(profileId: string, confirmation: string, expected: string) {
  let accepted = false;
  try {
    if (!validId(profileId) || process.env.APP_ADMIN_ACCOUNT_ERASURE_ENABLED !== "true") throw new Error("Disabled");
    const { client, user } = await owner();
    const { data, error } = await client.rpc("admin_account_deletion_scope", { p_profile_id: profileId });
    if (error || !data || confirmation !== `DELETE ${data.email}` || fingerprint(data) !== expected) {
      return { accepted: false, message: "The confirmation or account details changed. Refresh and review again." };
    }
    const store = await openLocalErasureStore();
    const admin = createLocalErasureAdmin();
    const result = await requestAdminRecordedErasure({ actorAuthId: user.id, profileId, store, rpc: async (name, args) => {
      const { data, error } = await admin.rpc(name, args);
      if (error) throw new Error("Request unavailable");
      return data;
    } });
    accepted = result.accepted;
    await startAdminErasureWorker(profileId);
    revalidatePath("/account/access");
    return { accepted, message: "Deletion recorded. Cleanup is running; completion may take a few minutes." };
  } catch {
    revalidatePath("/account/access");
    return { accepted, message: accepted
      ? "Deletion recorded, but cleanup could not start. Use Retry cleanup below."
      : "The request could not be confirmed. Refresh to check this account before trying again." };
  }
}

export async function retryManagedCleanup(profileId: string) {
  try {
    if (!validId(profileId) || process.env.APP_ADMIN_ACCOUNT_ERASURE_ENABLED !== "true") throw new Error("Disabled");
    const { client } = await owner();
    const { data, error } = await client.rpc("admin_account_cleanup_authorised", { p_profile_id: profileId });
    if (error || data !== true) throw new Error("Not pending");
    await startAdminErasureWorker(profileId);
    return { message: "Cleanup restarted for this account." };
  } catch { return { message: "Cleanup could not restart. The account remains unavailable; its deletion record is preserved." }; }
}
