import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PictureState = { assetId: string | null; url: string | null; version: number };
export type PictureKind = "profile" | "table";

export async function picturesReady(client: SupabaseClient) {
  const { data, error } = await client.rpc("pictures_ready");
  if (error && ["PGRST202", "42883"].includes(error.code)) return false;
  if (error) throw error;
  return data === true;
}

export async function pictures(client: SupabaseClient, kind: PictureKind, ids: string[]) {
  const result = new Map<string, PictureState>();
  const unique = [...new Set(ids)];
  if (!unique.length || !await picturesReady(client)) return result;
  for (let offset = 0; offset < unique.length; offset += 100) {
    const { data, error } = await client.rpc("picture_locations", { p_kind: kind, p_ids: unique.slice(offset, offset + 100) });
    if (error) throw error;
    await Promise.all((data ?? []).map(async (row: { target_id: string; asset_id: string | null; object_path: string | null; version: number }) => {
      let url: string | null = null;
      if (row.object_path) {
        const signed = await client.storage.from("plate-media").createSignedUrl(row.object_path, 300);
        // Removal/replacement can race signing; keep the initials fallback usable.
        if (!signed.error) url = signed.data.signedUrl;
      }
      result.set(row.target_id, { assetId: row.asset_id, url, version: Number(row.version) });
    }));
  }
  return result;
}
