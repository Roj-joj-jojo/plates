import type { SupabaseClient } from "@supabase/supabase-js";

export type FollowNotification = {
  id: string; kind: "follow_request" | "new_follower" | "follow_accepted"; sender_id: string; sender_name: string;
  sender_username: string; edge_id: string; edge_version: number;
  read_at: string | null; created_at: string;
};

export async function followNotifications(client: SupabaseClient): Promise<FollowNotification[]> {
  const { data, error } = await client.rpc("my_follow_notifications");
  if (error && ["PGRST202", "42883"].includes(error.code)) return [];
  if (error) throw error;
  return data ?? [];
}
