import type { Metadata } from "next";
import { CreatePlateForm } from "@/components/connected-actions";
import { BackLink } from "@/components/plate-content";
import { PageLayout } from "@/components/page-layout";
import { signedInClient } from "@/lib/supabase/connected";
import { plateImagesSchemaReady } from "@/lib/supabase/plate-images";

export const metadata: Metadata = { title: "Add a Plate" };
export const dynamic = "force-dynamic";

export default async function NewPlatePage() {
  const supabase = await signedInClient();
  const { data: categories, error } = await supabase.from("categories")
    .select("id, label").order("label");
  if (error) throw error;
  const imagesReady = await plateImagesSchemaReady(supabase);
  return <PageLayout title="Add a Plate" description="Share a meal, a recipe or a place worth trying." backLink={<BackLink href="/feed">Feed</BackLink>}>
    <CreatePlateForm categories={categories ?? []} imageUploadsReady={imagesReady} />
  </PageLayout>;
}
