import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { signedInClient } from "@/lib/supabase/connected";
import { conversationPeople } from "@/lib/supabase/conversation-people";
import { ConversationMeta, ConversationTimestamp } from "@/components/conversation-meta";
import { imagesForEntry, tableImages, tableImagesSchemaReady } from "@/lib/supabase/table-images";
import { contentControlAccess } from "@/lib/supabase/content-controls";
import { TableContentControls } from "@/components/content-controls";
import { PageLayout } from "@/components/page-layout";
import { activityReceipts, tableActivityPeriod } from "@/lib/supabase/table-activity";
import { ActivityReadMarker } from "@/components/activity-read-marker";

export const metadata: Metadata = { title: "Table message" };
export const dynamic = "force-dynamic";

export default async function MessagePage({ params }: {
  params: Promise<{ groupId: string; entryId: string }>;
}) {
  const { groupId, entryId } = await params;
  const supabase = await signedInClient();
  const activityPeriod = await tableActivityPeriod(supabase, groupId);
  const [{ data: group, error: groupError }, { data: entry, error: entryError }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).eq("availability", "available").maybeSingle(),
    supabase.from("timeline_content").select("*")
      .eq("id", entryId).eq("group_id", groupId).eq("kind", "message")
      .maybeSingle(),
  ]);
  if (groupError || entryError) throw groupError ?? entryError;
  if (!group || !entry) notFound();
  const controls = await contentControlAccess(supabase, groupId);
  const images = await tableImagesSchemaReady(supabase)
    ? imagesForEntry(await tableImages(supabase, groupId), entryId) : [];
  const people = await conversationPeople(supabase, entry.availability === "available" ? [entry.author_id] : []);
  const receipts = await activityReceipts(supabase, groupId, activityPeriod, entry.availability === "available" ? [entry] : [], [], true);
  return <PageLayout title="Table message" description={`Only members of ${group.name} can read this conversation, including people added later.`} backLink={<BackLink href={`/tables/${groupId}?entry=${entryId}#entry-${entryId}`}>View in {group.name}</BackLink>}
    readMarker={<ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.kind === "added").map(item => item.id)} />}>
    <article className="relative mt-4 rounded-lg border border-border bg-card p-4 sm:mt-6 sm:p-6">
      <ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.entry_id === entry.id).map(item => item.id)} />
      {entry.availability === "available" && <div className="pr-12"><ConversationMeta person={people.get(entry.author_id) ?? { profileId: null, name: "Former member" }} editedAt={entry.edited_at} /></div>}
      {entry.availability === "available" ? <>
      <PlateContent body={entry.body} links={entry.links} linkify />
      <PlateImages images={images} label="Table" />
      <ConversationTimestamp at={entry.created_at} editedAt={entry.edited_at} fullDate />
      {controls.ready && <TableContentControls id={entry.id} groupId={groupId} kind="message" body={entry.body}
        links={entry.links} hasPhotos={images.length > 0} updatedAt={entry.updated_at} canEdit={entry.author_id === controls.profileId}
        canRemove={entry.author_id === controls.profileId || controls.canModerate} />}
      </> : <p className="text-sm italic text-muted-foreground">This message was removed.</p>}
    </article>
  </PageLayout>;
}
