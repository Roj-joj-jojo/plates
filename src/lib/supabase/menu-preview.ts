import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlateImage } from "@/lib/supabase/plate-images";

export async function menuPreviewSchemaReady(supabase: SupabaseClient) {
  const { error } = await supabase.from("menu_preview_jobs").select("id").limit(0);
  if (!error) return true;
  if (error.code === "PGRST205" || error.code === "42P01") return false;
  throw error;
}

export async function menuPreview(supabase: SupabaseClient, saveId: string): Promise<PlateImage | null> {
  const { data: locations, error } = await supabase.rpc("menu_preview_location", { p_save_id: saveId });
  if (error) throw error;
  const location = locations?.[0] as { object_path: string; width: number; height: number } | undefined;
  if (!location) return null;
  const { data, error: signError } = await supabase.storage.from("menu-previews")
    .createSignedUrl(location.object_path, 3600);
  if (signError) throw signError;
  return { assetId: saveId, url: data.signedUrl, width: location.width, height: location.height };
}

export async function menuPreviews(supabase: SupabaseClient, saveId: string): Promise<PlateImage[]> {
  const { data, error } = await supabase.rpc("menu_gallery_locations", { p_save_id: saveId });
  if (error && ["PGRST202", "42883"].includes(error.code)) {
    const legacy = await menuPreview(supabase, saveId);
    return legacy ? [legacy] : [];
  }
  if (error) throw error;
  const locations = (data ?? []) as Array<{ asset_id: string; object_path: string; width: number; height: number }>;
  return Promise.all(locations.map(async location => {
    const { data: signed, error: signError } = await supabase.storage.from("menu-previews")
      .createSignedUrl(location.object_path, 3600);
    if (signError) throw signError;
    return { assetId: location.asset_id, url: signed.signedUrl, width: location.width, height: location.height };
  }));
}
