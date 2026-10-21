import type { SupabaseClient } from "@supabase/supabase-js";

export type PlateInteractionSummary = {
  plate_id: string; like_count: number; comment_count: number; liked: boolean; like_version: number;
};
export type PlateComment = {
  id: string; plate_id: string; author_id: string | null; author_name: string | null;
  author_username: string | null; body: string; state: "available" | "removed" | "erased";
  revision: number; created_at: string; edited_at: string | null; can_edit: boolean; can_remove: boolean;
};
export type PlateCommentNotification = {
  id: string; plate_id: string; comment_id: string; sender_name: string; sender_username: string | null;
  read_at: string | null; created_at: string;
};
export async function plateInteractionSummaries(client: SupabaseClient, ids: string[]) {
  const readiness = await client.rpc("plate_interactions_ready");
  const summaries = new Map<string, PlateInteractionSummary>();
  if (readiness.error && ["PGRST202", "42883"].includes(readiness.error.code)) return { ready: false, summaries };
  if (readiness.error) throw readiness.error;
  if (!readiness.data) return { ready: false, summaries };
  if (ids.length) {
    const { data, error } = await client.rpc("plate_interaction_summary", { p_plate_ids: ids });
    if (error) throw error;
    for (const row of (data ?? []) as PlateInteractionSummary[]) summaries.set(row.plate_id, {
      ...row, like_count: Number(row.like_count), comment_count: Number(row.comment_count), like_version: Number(row.like_version),
    });
  }
  return { ready: true, summaries };
}
export async function plateCommentNotifications(client: SupabaseClient): Promise<PlateCommentNotification[]> {
  const { data, error } = await client.rpc("my_plate_comment_notifications");
  if (error && ["PGRST202", "42883"].includes(error.code)) return [];
  if (error) throw error;
  return data ?? [];
}
