import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ThreadReply = { id: string; author_id: string | null; body: string; links: unknown; created_at: string; updated_at: string; edited_at: string | null; availability: string; position: number };
export async function threadReplies(client: SupabaseClient, threadId: string, focus?: string) {
  const { data, error } = await client.from("reply_content").select("*").eq("thread_id", threadId).order("position", { ascending: true }).limit(100);
  if (error) throw error;
  const replies = (data ?? []) as ThreadReply[];
  let focusedOutsidePage = false;
  if (typeof focus === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(focus) && !replies.some(reply => reply.id === focus)) {
    const found = await client.from("reply_content").select("*").eq("thread_id", threadId).eq("id", focus).maybeSingle();
    if (found.error) throw found.error;
    if (found.data) { replies.push(found.data as ThreadReply); replies.sort((a, b) => a.position - b.position); focusedOutsidePage = true; }
  }
  return { replies, focusedOutsidePage };
}
