import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { introductionStatus } from "@/lib/supabase/introduction";
import { Button } from "@/components/ui/button";
import { FeedCreateAction } from "@/components/feed-create-action";
import { PageLayout } from "@/components/page-layout";
import { PlateAuthor, PlateDate } from "@/components/plate-meta";
import { pictures } from "@/lib/supabase/pictures";
import { PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { SavePlateButton } from "@/components/connected-actions";
import { menuPreviewSchemaReady } from "@/lib/supabase/menu-preview";
import { signedInClient, profileNames, profileUsernames } from "@/lib/supabase/connected";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import { socialReady } from "@/lib/supabase/social";
import { plateInteractionSummaries } from "@/lib/supabase/plate-interactions";
import { PlateInteractionControls } from "@/components/plate-interactions";
import { plateDestination } from "@/lib/navigation-ux";
import { MANAGE_PEOPLE } from "@/lib/ui-copy";

export const metadata: Metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

type FeedPlate = { id: string; author_id: string; category_id: string; body: string; links: unknown; created_at: string; revision: number };
export default async function FeedPage({ searchParams }: { searchParams: Promise<{ before?: string; id?: string }> }) {
  const supabase = await signedInClient();
  const introduction = await introductionStatus(supabase);
  if (introduction.ready && !introduction.completed) redirect("/introduction");
  if (!await socialReady(supabase)) return <PageLayout title="Feed"><p className="text-sm text-muted-foreground">Your following Feed is not available yet. Please try again later.</p></PageLayout>;
  const params = await searchParams;
  const cursorValid = params.before && Number.isFinite(Date.parse(params.before)) && /^[0-9a-f-]{36}$/i.test(params.id ?? "");
  const [{ data: categories, error: categoriesError }, { data: plates, error: platesError }] = await Promise.all([
    supabase.from("categories").select("id, label").order("label"),
    supabase.rpc("following_feed", { p_before: cursorValid ? params.before : null, p_before_id: cursorValid ? params.id : null }),
  ]);
  if (categoriesError || platesError) throw categoriesError ?? platesError;
  const feedPlates = (plates ?? []) as FeedPlate[];
  const lastPlate = feedPlates.at(-1);
  const counts = await supabase.rpc("social_counts");
  if (counts.error) throw counts.error;
  const hasFollowing = Number(counts.data?.[0]?.following ?? 0) > 0;
  const requestCount = Number(counts.data?.[0]?.requests ?? 0);
  const imagesReady = await plateImagesSchemaReady(supabase);
  const photos = imagesReady ? await Promise.all(feedPlates.map((plate) => plateImages(supabase, plate.id))) : [];
  const plateIds = feedPlates.map(plate => plate.id);
  const interactions = await plateInteractionSummaries(supabase, plateIds);
  const { data: saves, error: savesError } = plateIds.length
    ? await supabase.from("menu_plate_saves").select("plate_id").in("plate_id", plateIds).eq("availability", "available")
    : { data: [], error: null };
  if (savesError) throw savesError;
  const savedIds = new Set((saves ?? []).map(save => save.plate_id));
  const previewsReady = photos.some(images => images.length > 0) ? await menuPreviewSchemaReady(supabase) : true;
  const names = await profileNames(supabase, feedPlates.map((plate) => plate.author_id));
  const usernames = await profileUsernames(supabase, feedPlates.map(plate => plate.author_id));
  const authorPictures = await pictures(supabase, "profile", feedPlates.map(plate => plate.author_id).filter(Boolean));
  const categoryNames = new Map((categories ?? []).map((category) => [category.id, category.label]));
  const feedHref = cursorValid ? `/feed?before=${encodeURIComponent(params.before!)}&id=${params.id}` : "/feed";
  return (
    <PageLayout title="Feed" description="Meals, recipes and places worth sharing.">
      <FeedCreateAction />
      <div className="pb-20 thread:pb-0">
      <section aria-label="Recent Plates">
        {feedPlates.length ? <ul className="space-y-4">{feedPlates.map((plate, index) => {
          const firstLine = plate.body.trimStart().split(/\r?\n/)[0];
          const headingLine = firstLine && Array.from(firstLine).length <= 72 && !/@\[[0-9a-f-]{36}\]/i.test(firstLine);
          const body = headingLine ? plate.body.trimStart().slice(firstLine.length).replace(/^\r?\n/, "") : plate.body;
          return <li key={plate.id} id={`plate-${plate.id}`} className="scroll-mt-6 rounded-lg border border-border bg-card p-4 sm:p-6">
          <PlateAuthor profileId={plate.author_id} name={names.get(plate.author_id) ?? "Former member"} username={usernames.get(plate.author_id)} pictureUrl={authorPictures.get(plate.author_id)?.url} category={categoryNames.get(plate.category_id) ?? "Plate"} edited={plate.revision > 1} />
          <div className="mt-3 sm:mt-4">
          {headingLine && <h2 className="mb-2 font-display text-base font-bold sm:mb-3 sm:text-plate-title">{firstLine}</h2>}
          <PlateContent body={body} links={plate.links} />
          <PlateImages images={photos[index] ?? []} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 [&>p]:mt-0">
            <Link href={plateDestination(plate.id, `${feedHref}#plate-${plate.id}`)} className="inline-flex min-h-11 items-center rounded-sm text-sm font-normal text-muted-foreground underline underline-offset-4 hover:text-link">View plate</Link>
          <PlateDate at={plate.created_at} />
          </div>
          <footer className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t pt-2 sm:mt-5 sm:pt-3 [&>div]:mt-0">
            {interactions.summaries.has(plate.id) && <PlateInteractionControls summary={interactions.summaries.get(plate.id)!} commentsHref={`${plateDestination(plate.id, `${feedHref}#plate-${plate.id}`)}#comments`} />}
            <div className="ml-auto min-w-0 max-w-full">{previewsReady || savedIds.has(plate.id) || !(photos[index]?.length)
              ? <SavePlateButton compact plateId={plate.id} revision={plate.revision} saved={savedIds.has(plate.id)} hasPhotos={Boolean(photos[index]?.length)} />
              : <p className="text-sm text-muted-foreground">Photo saving is temporarily unavailable.</p>}</div>
          </footer>
        </li>; })}</ul> : <div className="rounded-lg border border-border bg-muted p-6">
          <h2 className="font-display text-xl font-bold">{cursorValid ? "You’re all caught up" : hasFollowing ? "Nothing shared here yet" : "Bring some people to your Feed"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{cursorValid ? "There are no older Plates to show." : hasFollowing ? "The people you follow haven’t shared any Plates yet. You can add something of your own or find more people to follow." : "Follow people to see their meals, recipes and places here. Private accounts appear once they approve your request. Your own Plates appear here too."}</p>
          <Button asChild variant="outline" className="mt-4"><Link href={cursorValid ? "/feed" : "/search?type=people"}>{cursorValid ? "Back to latest Plates" : "Find people"}</Link></Button>
        </div>}
      </section>
      {feedPlates.length > 0 && feedPlates.length < 30 && <p className="mt-6 text-sm text-muted-foreground">You’re all caught up. There are no older Plates to show.</p>}
      <nav aria-label="Feed pages" className="mt-4 flex flex-wrap gap-6">
        {cursorValid && <Link href="/feed" className="inline-flex min-h-11 items-center text-link underline">Latest Plates</Link>}
        {feedPlates.length === 30 && lastPlate && <Link href={`/feed?before=${encodeURIComponent(lastPlate.created_at)}&id=${lastPlate.id}`} className="inline-flex min-h-11 items-center text-link underline">Older Plates</Link>}
        <Link href={requestCount ? "/people?list=requests" : "/people"} className="inline-flex min-h-11 items-center text-link underline">{requestCount ? `${MANAGE_PEOPLE} · ${requestCount} follow ${requestCount === 1 ? "request" : "requests"}` : MANAGE_PEOPLE}</Link>
      </nav>
      </div>
    </PageLayout>
  );
}
