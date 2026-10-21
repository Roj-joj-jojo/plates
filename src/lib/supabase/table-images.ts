import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlateImage } from "@/lib/supabase/plate-images";

export type TableImage = PlateImage & {
  entryId: string | null;
  replyId: string | null;
  position: number;
  occurredAt: string;
};

export async function tableImagesSchemaReady(supabase: SupabaseClient) {
  const { error } = await supabase.from("table_upload_intents").select("id").limit(0);
  if (!error) return true;
  if (error.code === "PGRST205" || error.code === "42P01") return false;
  throw error;
}

export async function tableImages(supabase: SupabaseClient, groupId: string): Promise<TableImage[]> {
  const { data: locations, error } = await supabase.rpc("table_image_locations", { p_group_id: groupId });
  if (error) throw error;
  return Promise.all((locations ?? []).map(async (location: {
    asset_id: string; object_path: string; width: number; height: number;
    entry_id: string | null; reply_id: string | null; image_position: number; occurred_at: string;
  }) => {
    const { data, error: signError } = await supabase.storage.from("table-media")
      .createSignedUrl(location.object_path, 3600);
    if (signError) throw signError;
    return { assetId: location.asset_id, url: data.signedUrl, width: location.width,
      height: location.height, entryId: location.entry_id, replyId: location.reply_id,
      position: location.image_position, occurredAt: location.occurred_at };
  }));
}

export function imagesForEntry(images: TableImage[], entryId: string): PlateImage[] {
  return images.filter((image) => image.entryId === entryId)
    .sort((left, right) => left.position - right.position);
}

export function imagesForReply(images: TableImage[], replyId: string): PlateImage[] {
  return images.filter((image) => image.replyId === replyId)
    .sort((left, right) => left.position - right.position);
}
