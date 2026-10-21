import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SavePlateButton } from "@/components/connected-actions";
import { BackLink, PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { signedInClient } from "@/lib/supabase/connected";
import { conversationPeople } from "@/lib/supabase/conversation-people";
import { ConversationMeta, ConversationTimestamp } from "@/components/conversation-meta";
import { TableReplies } from "@/components/table-replies";
import { menuPreviewSchemaReady } from "@/lib/supabase/menu-preview";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import { tableImages, tableImagesSchemaReady } from "@/lib/supabase/table-images";
import { contentControlAccess } from "@/lib/supabase/content-controls";
import { TableContentControls } from "@/components/content-controls";
import { PageLayout } from "@/components/page-layout";
import { privateTablePlates } from "@/lib/supabase/social";
import { PrivatePlateNotice } from "@/components/people-list";
import { activityReceipts, tableActivityPeriod } from "@/lib/supabase/table-activity";
import { ActivityReadMarker } from "@/components/activity-read-marker";
import { threadReplies } from "@/lib/supabase/thread-replies";

export const metadata: Metadata = { title: "Table discussion" };
export const dynamic = "force-dynamic";

export default async function DiscussionPage({ params, searchParams }: { params: Promise<{ groupId: string; shareId: string }>; searchParams: Promise<{ reply?: string }> }) {
  const { groupId, shareId } = await params;
  const supabase = await signedInClient();
  const activityPeriod = await tableActivityPeriod(supabase, groupId);
  const [{ data: group, error: groupError }, { data: entry, error: entryError },
    { data: share, error: shareError }, { data: thread, error: threadError }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).eq("availability", "available").maybeSingle(),
    supabase.from("timeline_content").select("*")
      .eq("id", shareId).eq("group_id", groupId).eq("kind", "plate_share").maybeSingle(),
    supabase.from("plate_shares").select("plate_id, plate_revision_at_share").eq("entry_id", shareId).maybeSingle(),
    supabase.from("threads").select("id").eq("root_entry_id", shareId).eq("group_id", groupId).maybeSingle(),
  ]);
  if (groupError || entryError || shareError || threadError) throw groupError ?? entryError ?? shareError ?? threadError;
  if (!group || !entry || !share || !thread) notFound();
  const controls = await contentControlAccess(supabase, groupId);
  const [{ data: plate, error: plateError }, replyPage,
    { data: save, error: saveError }] = await Promise.all([
    supabase.from("plates").select("id, author_id, body, links, revision")
      .eq("id", share.plate_id).eq("availability", "available").maybeSingle(),
    threadReplies(supabase, thread.id, (await searchParams).reply),
    supabase.from("menu_plate_saves").select("id").eq("plate_id", share.plate_id).eq("availability", "available").maybeSingle(),
  ]);
  if (plateError || saveError) throw plateError ?? saveError;
  const { replies, focusedOutsidePage } = replyPage;
  const privateNotices = await privateTablePlates(supabase, groupId, [share.plate_id]);
  const { data: savedSource, error: savedSourceError } = save
    ? await supabase.from("menu_plate_sources").select("share_entry_id")
      .eq("save_id", save.id).eq("share_entry_id", shareId).maybeSingle()
    : { data: null, error: null };
  if (savedSourceError) throw savedSourceError;
  const images = plate && await plateImagesSchemaReady(supabase) ? await plateImages(supabase, plate.id) : [];
  const tablePhotosReady = await tableImagesSchemaReady(supabase);
  const tablePhotos = tablePhotosReady ? await tableImages(supabase, groupId) : [];
  const previewsReady = images.length === 0 || await menuPreviewSchemaReady(supabase);
  const people = await conversationPeople(supabase, [entry.author_id, plate?.author_id ?? null, ...(replies ?? []).filter(reply => reply.availability === "available").map(reply => reply.author_id)]);
  const receipts = await activityReceipts(supabase, groupId, activityPeriod, entry.availability === "available" ? [entry] : [], replies.filter(reply => reply.availability === "available"), true);
  return <PageLayout title={`Replies in ${group.name}`} description="A private Table conversation about a shared Plate. Comments on the original Plate stay separate." backLink={<BackLink href={`/tables/${groupId}`}>Back to {group.name}</BackLink>}
    readMarker={<ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.kind === "added").map(item => item.id)} />}>
    <article className="relative mt-4 rounded-lg border border-border bg-card p-4 sm:mt-6 sm:p-6">
      <ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.entry_id === entry.id).map(item => item.id)} />
      <p className="mb-3 text-label text-link">Shared into this Table</p>
      {entry.availability === "available" && <div className="pr-12"><ConversationMeta person={people.get(entry.author_id) ?? { profileId: null, name: "Former member" }} editedAt={entry.edited_at} /></div>}
      {entry.availability === "available" ? <>
      <PlateContent body={entry.body} links={entry.links} linkify />
      <div className="mt-4 border-l-4 border-input bg-card pl-4">
        {plate ? <><p className="mb-2 min-h-11 pr-12 text-sm text-muted-foreground">Original Plate by {people.get(plate.author_id)?.name ?? "Former member"}{plate.revision > share.plate_revision_at_share ? " · Edited since shared" : ""}</p>
          <PlateContent body={plate.body} links={plate.links} />
          <PlateImages images={images} />
          <Link href={`/feed/${plate.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline underline-offset-4 hover:text-link">View plate</Link>
          {previewsReady || save ? <SavePlateButton plateId={plate.id} revision={plate.revision} shareId={shareId} saved={Boolean(save)} sourceSaved={Boolean(savedSource)} hasPhotos={images.length > 0} />
            : <p className="mt-5 text-sm text-muted-foreground">Saving photo Plates to Menu will be available when private saved previews are ready.</p>}
        </> : privateNotices.has(share.plate_id) ? <PrivatePlateNotice authorId={privateNotices.get(share.plate_id)!} /> : <p className="text-sm text-muted-foreground">This Plate is no longer available. The discussion remains here.</p>}
      </div>
      <ConversationTimestamp at={entry.created_at} editedAt={entry.edited_at} fullDate />
      {controls.ready && <TableContentControls id={entry.id} groupId={groupId} kind="plate_share" body={entry.body}
        links={entry.links} updatedAt={entry.updated_at} canEdit={entry.author_id === controls.profileId}
        canRemove={entry.author_id === controls.profileId || controls.canModerate} />}
      </> : <p className="text-sm text-muted-foreground">Share removed. The original Plate is unchanged and existing replies remain below.</p>}
    </article>
    <TableReplies replies={replies} people={people} images={tablePhotos} controls={controls} groupId={groupId} tableName={group.name} threadId={thread.id} open={entry.availability === "available"} photosReady={tablePhotosReady} aboutPlate receipts={receipts} activityPeriod={activityPeriod} focusedOutsidePage={focusedOutsidePage} />
  </PageLayout>;
}
