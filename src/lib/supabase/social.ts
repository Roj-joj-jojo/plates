import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SocialPerson = {
  profile_id: string; username: string; display_name: string;
  is_private: boolean; is_me: boolean; follow_state: string; follow_version: number;
  edge_id?: string; edge_version?: number;
};

export async function socialReady(client: SupabaseClient) {
  const { data, error } = await client.rpc("social_ready");
  if (error && ["PGRST202", "42883"].includes(error.code)) return false;
  if (error) throw error;
  return data === true;
}

export async function privateTablePlates(client: SupabaseClient, groupId: string, ids: string[]) {
  const result = new Map<string, string>();
  if (!ids.length || !await socialReady(client)) return result;
  const { data, error } = await client.rpc("private_table_plates", { p_group_id: groupId, p_ids: [...new Set(ids)] });
  if (error) throw error;
  for (const row of data ?? []) result.set(row.plate_id, row.author_id);
  return result;
}
