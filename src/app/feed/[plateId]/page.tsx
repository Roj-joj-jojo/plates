import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavePlateButton } from "@/components/connected-actions";
import { BackLink, PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { profileNames, profileUsernames, signedInClient } from "@/lib/supabase/connected";
import { PlateAuthor, PlateDate } from "@/components/plate-meta";
import { menuPreviewSchemaReady } from "@/lib/supabase/menu-preview";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import { contentControlAccess } from "@/lib/supabase/content-controls";
import { PlateDetailCard } from "@/components/plate-detail-card";
import { PageLayout } from "@/components/page-layout";
import { pictures } from "@/lib/supabase/pictures";
import { plateInteractionSummaries, type PlateComment } from "@/lib/supabase/plate-interactions";
import { PlateComments, PlateInteractionControls } from "@/components/plate-interactions";
import { plateHeading, plateReturn } from "@/lib/navigation-ux";

export const metadata: Metadata = { title: "Plate" };
export const dynamic = "force-dynamic";

export default async function PlatePage({ params, searchParams }: { params: Promise<{ plateId: string }>; searchParams: Promise<{ commentsBefore?: string | string[]; commentCursor?: string | string[]; comment?: string | string[]; returnTo?: string | string[] }> }) {
  const { plateId } = await params;
  const supabase = await signedInClient();
  const { data: plate, error } = await supabase.from("plates")
    .select("id, author_id, category_id, body, links, tags, revision, created_at")
    .eq("id", plateId).eq("availability", "available").maybeSingle();
  if (error || !plate) notFound();
  const controls = await contentControlAccess(supabase);
  const [{ data: categories, error: categoriesError }, { data: groups, error: groupsError },
    { data: save, error: saveError }, { data: myProfile, error: myProfileError }, names] = await Promise.all([
    supabase.from("categories").select("id, label").order("label"),
    supabase.from("groups").select("id, name").eq("availability", "available").order("name"),
    supabase.from("menu_plate_saves").select("id").eq("plate_id", plateId).eq("availability", "available").maybeSingle(),
    supabase.from("my_profile").select("id").maybeSingle(),
    profileNames(supabase, [plate.author_id]),
  ]);
  if (categoriesError || groupsError || saveError || myProfileError)
    throw categoriesError ?? groupsError ?? saveError ?? myProfileError;
  const images = await plateImagesSchemaReady(supabase) ? await plateImages(supabase, plateId) : [];
  const previewsReady = images.length === 0 || await menuPreviewSchemaReady(supabase);
  const category = categories?.find((item) => item.id === plate.category_id);
  const authorPicture = (await pictures(supabase, "profile", [plate.author_id])).get(plate.author_id);
  const interactions = await plateInteractionSummaries(supabase, [plateId]);
  const summary = interactions.summaries.get(plateId);
  const search = await searchParams;
  const back = plateReturn(search.returnTo);
  const heading = plateHeading(plate.body);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const before = typeof search.commentsBefore === "string" ? search.commentsBefore : undefined;
  const cursor = typeof search.commentCursor === "string" ? search.commentCursor : undefined;
  const linkedId = typeof search.comment === "string" ? search.comment : undefined;
  const cursorValid = Boolean(before && Number.isFinite(Date.parse(before)) && uuid.test(cursor ?? ""));
  let comments: PlateComment[] = [], linkedComment: PlateComment | null = null;
  if (summary) {
    const [page, linked] = await Promise.all([
      supabase.rpc("plate_comments_page", { p_plate_id: plateId, p_before: cursorValid ? before : null, p_before_id: cursorValid ? cursor : null }),
      uuid.test(linkedId ?? "") ? supabase.rpc("plate_comment_by_id", { p_plate_id: plateId, p_comment_id: linkedId }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (page.error || linked.error) throw page.error ?? linked.error;
    comments = page.data ?? []; linkedComment = linked.data?.[0] ?? null;
  }
  const lastComment = comments.at(-1);
  const olderHref = comments.length === 30 && lastComment ? `/feed/${plateId}?commentsBefore=${encodeURIComponent(lastComment.created_at)}&commentCursor=${lastComment.id}&returnTo=${encodeURIComponent(back.href)}#comments` : undefined;
  const usernames = await profileUsernames(supabase, [plate.author_id]);
  const commentAvatars = await pictures(supabase, "profile", [...comments, ...(linkedComment ? [linkedComment] : [])]
    .filter(comment => comment.state === "available" && comment.author_id).map(comment => comment.author_id!));
  const commentPictures = Object.fromEntries([...commentAvatars].map(([id, picture]) => [id, picture.url]));
  return <PageLayout title={heading} backLink={<BackLink href={back.href}>{back.label}</BackLink>}>
    <PlateDetailCard plateId={plate.id} revision={plate.revision} canEdit={myProfile?.id === plate.author_id}
      canUnpublish={controls.ready && myProfile?.id === plate.author_id} groups={groups ?? []}
      editValues={{ plateId: plate.id, revision: plate.revision, categoryId: plate.category_id, body: plate.body,
        links: plate.links, tags: plate.tags, categories: categories ?? [], attachmentIds: images.map(image => image.assetId) }}
      author={<PlateAuthor profileId={plate.author_id} name={names.get(plate.author_id) ?? "Former member"} username={usernames.get(plate.author_id)} pictureUrl={authorPicture?.url} category={category?.label ?? "Plate"} edited={plate.revision > 1} />}
      saveAction={previewsReady || save ? <SavePlateButton compact plateId={plate.id} revision={plate.revision} saved={Boolean(save)} hasPhotos={images.length > 0} />
        : <p className="text-sm text-muted-foreground">Saving photo Plates to Menu will be available when private saved previews are ready.</p>}>
      <PlateContent body={plate.body} links={plate.links} />
      <PlateImages images={images} />
      <PlateDate at={plate.created_at} />
      {summary && <div className="mt-5"><PlateInteractionControls summary={summary} commentsHref={`/feed/${plateId}?returnTo=${encodeURIComponent(back.href)}#comments`} /></div>}
    </PlateDetailCard>
    {summary && <PlateComments plateId={plateId} comments={comments} linkedComment={linkedComment} olderHref={olderHref} newestHref={`/feed/${plateId}?returnTo=${encodeURIComponent(back.href)}#comments`} olderPage={cursorValid} commentPictures={commentPictures} />}
  </PageLayout>;
}
