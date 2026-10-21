import type { SupabaseClient } from "@supabase/supabase-js";

export type MenuItemKind = "plate" | "request";
export type MenuItemState = { save_id: string; removed_at: string | null; menu_version: number };

export async function menuRemovalReady(client: SupabaseClient) {
  const { data, error } = await client.rpc("menu_removal_ready");
  if (error && ["PGRST202", "42883"].includes(error.code)) return false;
  if (error) throw error;
  return data === true;
}
