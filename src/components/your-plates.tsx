import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { PlateDate } from "@/components/plate-meta";
import { plateDestination } from "@/lib/navigation-ux";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import type { signedInClient } from "@/lib/supabase/connected";

export async function YourPlates({ client, page: rawPage }: {
  client: Awaited<ReturnType<typeof signedInClient>>; page?: string | string[];
}) {
  const requestedPage = typeof rawPage === "string" && /^[1-9]\d{0,4}$/.test(rawPage) ? Number(rawPage) : 1;
  const page = requestedPage <= 10000 ? requestedPage : 1;
  const pageSize = 30;
  const { data: profile, error: profileError } = await client.from("my_profile").select("id").single();
  if (profileError || !profile?.id) throw profileError ?? new Error("Your profile is unavailable");
  const [{ data: posts, error }, { data: categories, error: categoryError }] = await Promise.all([
    client.from("plates").select("id,category_id,body,links,created_at,revision")
      .eq("author_id", profile.id).eq("availability", "available")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize),
    client.from("categories").select("id,label"),
  ]);
  if (error || categoryError) throw error ?? categoryError;
  const plates = (posts ?? []).slice(0, pageSize);
  const hasOlder = (posts?.length ?? 0) > pageSize;
  const categoryNames = new Map((categories ?? []).map(category => [category.id, category.label]));
  const imagesReady = plates.length > 0 && await plateImagesSchemaReady(client);
  const photos = imagesReady ? await Promise.all(plates.map(plate => plateImages(client, plate.id))) : [];
  const pageHref = page === 1 ? "/menu?view=plates" : `/menu?view=plates&page=${page}`;
  return <section className="mt-6" aria-label="Your published Plates">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Your published Plates, newest first. Open a Plate to view or edit it.</p>
      <Button asChild><Link href="/feed/new">Add a Plate</Link></Button>
    </div>
    {plates.length ? <ul className="mt-5 space-y-4">{plates.map((plate, index) => <li key={plate.id} id={`plate-${plate.id}`} className="scroll-mt-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <p className="mb-3 text-sm text-muted-foreground">{categoryNames.get(plate.category_id) ?? "Plate"}{plate.revision > 1 && " · Edited"}</p>
      <PlateContent body={plate.body} links={plate.links} />
      <PlateImages images={photos[index] ?? []} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 [&>p]:mt-0">
        <Link href={plateDestination(plate.id, `${pageHref}#plate-${plate.id}`)} className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline hover:text-link">View or edit Plate</Link>
        <PlateDate at={plate.created_at} />
      </div>
    </li>)}</ul> : <p className="mt-8 text-sm text-muted-foreground">{page > 1 ? "No older Plates to show." : "You haven’t shared any Plates yet. Add a Plate to share a meal, recipe or place."}</p>}
    {(page > 1 || hasOlder) && <nav aria-label="Your Plates pages" className="mt-5 flex flex-wrap gap-6">
      {page > 1 && <Link href={page === 2 ? "/menu?view=plates" : `/menu?view=plates&page=${page - 1}`} className="inline-flex min-h-11 items-center text-link underline">Newer Plates</Link>}
      {hasOlder && page < 10000 && <Link href={`/menu?view=plates&page=${page + 1}`} className="inline-flex min-h-11 items-center text-link underline">Older Plates</Link>}
    </nav>}
  </section>;
}
