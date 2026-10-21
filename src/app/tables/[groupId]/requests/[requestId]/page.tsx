import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SaveRequestButton } from "@/components/connected-actions";
import { BackLink, PlateContent } from "@/components/plate-content";
import { signedInClient } from "@/lib/supabase/connected";
import { conversationPeople } from "@/lib/supabase/conversation-people";
import { ConversationMeta, ConversationTimestamp } from "@/components/conversation-meta";
import { TableReplies } from "@/components/table-replies";
import { tableImages, tableImagesSchemaReady } from "@/lib/supabase/table-images";
import { contentControlAccess } from "@/lib/supabase/content-controls";
import { TableContentControls } from "@/components/content-controls";
import { PageLayout } from "@/components/page-layout";
import { activityReceipts, tableActivityPeriod } from "@/lib/supabase/table-activity";
import { ActivityReadMarker } from "@/components/activity-read-marker";
import { threadReplies } from "@/lib/supabase/thread-replies";

export const metadata: Metadata = { title: "Table question" };
export const dynamic = "force-dynamic";

export default async function RequestPage({ params, searchParams }: {
  params: Promise<{ groupId: string; requestId: string }>;
  searchParams: Promise<{ reply?: string }>;
}) {
  const { groupId, requestId } = await params;
  const supabase = await signedInClient();
  const activityPeriod = await tableActivityPeriod(supabase, groupId);
  const [{ data: group, error: groupError }, { data: entry, error: entryError },
    { data: request, error: requestError }, { data: thread, error: threadError },
    { data: save, error: saveError }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).eq("availability", "available").maybeSingle(),
    supabase.from("timeline_content").select("*")
      .eq("id", requestId).eq("group_id", groupId).eq("kind", "request").maybeSingle(),
    supabase.from("requests").select("entry_id, question").eq("entry_id", requestId).maybeSingle(),
    supabase.from("threads").select("id").eq("root_entry_id", requestId).eq("group_id", groupId).maybeSingle(),
    supabase.from("menu_request_saves").select("id").eq("request_entry_id", requestId).maybeSingle(),
  ]);
  if (groupError || entryError || requestError || threadError || saveError) {
    throw groupError ?? entryError ?? requestError ?? threadError ?? saveError;
  }
  if (!group || !entry || !request || !thread) notFound();
  const controls = await contentControlAccess(supabase, groupId);
  const { replies, focusedOutsidePage } = await threadReplies(supabase, thread.id, (await searchParams).reply);
  const tablePhotosReady = await tableImagesSchemaReady(supabase);
  const tablePhotos = tablePhotosReady ? await tableImages(supabase, groupId) : [];
  const people = await conversationPeople(supabase, [entry.author_id, ...(replies ?? []).filter(reply => reply.availability === "available").map(reply => reply.author_id)]);
  const receipts = await activityReceipts(supabase, groupId, activityPeriod, entry.availability === "available" ? [entry] : [], replies.filter(reply => reply.availability === "available"), true);
  return <PageLayout title="Table question" description={`A question for ${group.name}. Save it to your Menu as a Request to revisit these replies.`} backLink={<BackLink href={`/tables/${groupId}`}>Back to {group.name}</BackLink>}
    readMarker={<ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.kind === "added").map(item => item.id)} />}>
    <article className="relative mt-4 rounded-lg border border-border bg-card p-4 sm:mt-6 sm:p-6">
      <ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.entry_id === entry.id).map(item => item.id)} />
      {entry.availability === "available" && <div className="pr-12"><ConversationMeta person={people.get(entry.author_id) ?? { profileId: null, name: "Former member" }} editedAt={entry.edited_at} /></div>}
      {entry.availability === "available" ? <>
      <h2 className="text-xl font-semibold">{request.question}</h2>
      {(entry.body || (Array.isArray(entry.links) && entry.links.length > 0)) &&
        <div className="mt-4"><p className="mb-2 text-sm font-semibold">Supporting context</p>
          <PlateContent body={entry.body} links={entry.links} linkify /></div>}
      <ConversationTimestamp at={entry.created_at} editedAt={entry.edited_at} fullDate />
      {entry.availability === "available" && <SaveRequestButton requestId={requestId} saved={Boolean(save)} />}
      {controls.ready && <TableContentControls id={entry.id} groupId={groupId} kind="request" body={entry.body}
        links={entry.links} question={request.question} updatedAt={entry.updated_at} canEdit={entry.author_id === controls.profileId}
        canRemove={entry.author_id === controls.profileId || controls.canModerate} />}
      </> : <p className="text-sm italic text-muted-foreground">This question was removed. Existing replies remain below.</p>}
    </article>
    <TableReplies replies={replies} people={people} images={tablePhotos} controls={controls} groupId={groupId} tableName={group.name} threadId={thread.id} open={entry.availability === "available"} photosReady={tablePhotosReady} receipts={receipts} activityPeriod={activityPeriod} focusedOutsidePage={focusedOutsidePage} />
  </PageLayout>;
}
