import "server-only";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./config";
import { createReadClient } from "./server";

export async function signedInClient() {
  if (!isSupabaseConfigured()) redirect("/signin");
  const supabase = await createReadClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/signin");
  const username = await supabase.rpc("my_username");
  if (!username.error && !username.data) redirect("/choose-username");
  return supabase;
}

export async function profileNames(
  supabase: Awaited<ReturnType<typeof signedInClient>>,
  ids: (string | null)[],
) {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.from("profile_directory")
    .select("id, display_name").in("id", uniqueIds);
  if (error) throw error;
  return new Map((data ?? []).map((profile) => [profile.id, profile.display_name ?? "Former member"]));
}

export async function requestSchemaReady(supabase: Awaited<ReturnType<typeof signedInClient>>) {
  const { error } = await supabase.from("requests").select("entry_id").limit(0);
  if (!error) return true;
  if (error.code === "PGRST205" || error.code === "42P01") return false;
  throw error;
}

export async function profileUsernames(supabase: Awaited<ReturnType<typeof signedInClient>>, ids: (string | null)[]) {
  const usernames = new Map<string, string>();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const { data, error } = await supabase.rpc("resolve_mentions", { p_ids: unique.slice(offset, offset + 100) });
    if (error && ["PGRST202", "42883"].includes(error.code)) return usernames;
    if (error) throw error;
    for (const person of data ?? []) usernames.set(person.profile_id, person.username);
  }
  return usernames;
}
