import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function introductionStatus(client: SupabaseClient) {
  const { data, error } = await client.rpc("my_introduction_completed");
  if (error && ["PGRST202", "42883"].includes(error.code)) return { ready: false, completed: false };
  if (error) throw new Error("Introduction settings unavailable");
  return { ready: true, completed: data === true };
}
