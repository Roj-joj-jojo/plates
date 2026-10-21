import "server-only";
import type { signedInClient } from "./connected";

export async function contentControlAccess(client: Awaited<ReturnType<typeof signedInClient>>, groupId?: string) {
  const { data, error } = await client.rpc("content_control_access", { p_group_id: groupId ?? null });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return { ready: false, profileId: null, canModerate: false };
    }
    throw error;
  }
  const access = data?.[0];
  return { ready: Boolean(access), profileId: access?.profile_id ?? null, canModerate: Boolean(access?.can_moderate) };
}
