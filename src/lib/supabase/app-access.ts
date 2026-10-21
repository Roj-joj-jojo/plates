import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function appAccessStatus(client: SupabaseClient) {
  const { data, error } = await client.rpc("app_access_status");
  if (error) {
    // Preserve the current local preview while the migration awaits approval.
    if (["PGRST202", "42883"].includes(error.code)) return { ready: false, enabled: false, canManage: false };
    throw new Error("App access settings unavailable");
  }
  return { ready: true, enabled: data?.enabled === true, canManage: data?.can_manage === true };
}
