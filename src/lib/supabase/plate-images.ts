import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlateImage = {
  assetId: string;
  url: string;
  width: number;
  height: number;
};

export async function plateImages(supabase: SupabaseClient, plateId: string, limit = Infinity): Promise<PlateImage[]> {
  const { data: locations, error } = await supabase.rpc("plate_image_locations", { p_plate_id: plateId });
  if (error) throw error;
  return Promise.all((locations ?? []).slice(0, limit).map(async (location: {
    asset_id: string; object_path: string; width: number; height: number;
  }) => {
    const { data, error: signError } = await supabase.storage.from("plate-media")
      .createSignedUrl(location.object_path, 300);
    if (signError) throw signError;
    return { assetId: location.asset_id, url: data.signedUrl,
      width: location.width, height: location.height };
  }));
}

export async function plateImagesSchemaReady(supabase: SupabaseClient) {
  const { error } = await supabase.from("media_upload_intents").select("id").limit(0);
  if (!error) return true;
  if (error.code === "PGRST205" || error.code === "42P01") return false;
  throw error;
}
