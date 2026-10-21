import type { SupabaseClient } from "@supabase/supabase-js";

export type TableActivity = { group_id: string; table_name: string; unread_count: number; mention_count: number; latest_id: string; sender_name: string; sender_username: string | null; kind: string; destination: string; created_at: string };
export type ActivityReceipt = { id: string; entry_id: string | null; reply_id: string | null; kind: string };
export type RenderedSource = { id: string; updated_at: string };
const missing = (code?: string) => code === "PGRST202" || code === "42883";

export async function tableActivityReady(client: SupabaseClient) {
  const { data, error } = await client.rpc("table_activity_ready");
  if (error && missing(error.code)) return false;
  if (error) throw error;
  return data === true;
}
export async function tableActivityPeriod(client: SupabaseClient, groupId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) return null;
  if (!await tableActivityReady(client)) return null;
  const { data, error } = await client.rpc("table_activity_period", { p_group_id: groupId });
  if (error) throw error;
  return data as string | null;
}
export async function myTableActivity(client: SupabaseClient): Promise<TableActivity[] | null> {
  if (!await tableActivityReady(client)) return null;
  const { data, error } = await client.rpc("my_table_activity");
  if (error) throw error;
  return (data ?? []).map((row: TableActivity) => ({ ...row, unread_count: Number(row.unread_count), mention_count: Number(row.mention_count) }));
}
export async function activityReceipts(client: SupabaseClient, groupId: string, periodId: string | null,
  entries: RenderedSource[] = [], replies: RenderedSource[] = [], membership = false): Promise<ActivityReceipt[]> {
  if (!periodId) return [];
  const { data, error } = await client.rpc("table_activity_receipts", {
    p_group_id: groupId, p_period_id: periodId, p_entries: entries.map(({ id, updated_at }) => ({ id, updated_at })),
    p_replies: replies.map(({ id, updated_at }) => ({ id, updated_at })), p_membership: membership,
  });
  // Membership can end between the page read and receipt lookup. No read is
  // acknowledged on refusal; the next normal access check handles the page.
  if (error?.code === "42501") return [];
  if (error) throw error;
  return data ?? [];
}
