import { Fragment } from "react";
import { ConversationDay, ConversationMeta, ConversationTimestamp, type ConversationPerson } from "@/components/conversation-meta";
import { TableContentControls } from "@/components/content-controls";
import { ReplyForm } from "@/components/connected-actions";
import { PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { imagesForReply, type TableImage } from "@/lib/supabase/table-images";
import type { contentControlAccess } from "@/lib/supabase/content-controls";
import { conversationCount, startsConversationDay } from "@/lib/conversation-ux";
import type { ActivityReceipt } from "@/lib/supabase/table-activity";
import { ActivityReadMarker } from "@/components/activity-read-marker";

type Reply = { id: string; author_id: string | null; body: string; links: unknown; created_at: string; updated_at: string; edited_at: string | null; availability: string };

export function TableReplies({ replies, people, images, controls, groupId, tableName, threadId, open, photosReady, aboutPlate = false, receipts = [], activityPeriod = null, focusedOutsidePage = false }: {
  replies: Reply[]; people: Map<string, ConversationPerson>; images: TableImage[];
  controls: Awaited<ReturnType<typeof contentControlAccess>>; groupId: string; tableName: string; threadId: string; open: boolean; photosReady: boolean; aboutPlate?: boolean; receipts?: ActivityReceipt[]; activityPeriod?: string | null; focusedOutsidePage?: boolean;
}) {
  const active = replies.filter(reply => reply.availability === "available").length;
  return <section className="mt-8" aria-labelledby="table-replies-heading">
    <h2 id="table-replies-heading" className="font-display text-xl font-bold">Replies in {tableName}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{conversationCount(active, "active reply", "active replies")} shown · Oldest first. Removed replies stay in place and are not included in this count.</p>
    {focusedOutsidePage && <p className="mt-2 text-sm text-muted-foreground">Earlier replies and the linked reply are shown below. Replies between them are not shown.</p>}
    {replies.length ? <ol className="mt-4 space-y-3">{replies.map((reply, index) => <Fragment key={reply.id}>
      {startsConversationDay(reply.created_at, replies[index - 1]?.created_at) && <li><ConversationDay at={reply.created_at} /></li>}
      <li id={`reply-${reply.id}`} className="relative rounded-lg border border-border bg-card p-4 sm:p-5">
        {reply.availability === "available" ? <>
          <ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.reply_id === reply.id).map(item => item.id)} />
          <ConversationMeta person={people.get(reply.author_id ?? "") ?? { profileId: null, name: "Former member" }} editedAt={reply.edited_at}
            actions={controls.ready && <TableContentControls placement="inline" authorName={people.get(reply.author_id ?? "")?.name} id={reply.id} groupId={groupId} kind="reply" body={reply.body} links={reply.links} hasPhotos={imagesForReply(images, reply.id).length > 0} updatedAt={reply.updated_at} canEdit={reply.author_id === controls.profileId} canRemove={reply.author_id === controls.profileId || controls.canModerate} />} />
          <PlateContent body={reply.body} links={reply.links} linkify /><PlateImages images={imagesForReply(images, reply.id)} label="Table" />
          <ConversationTimestamp at={reply.created_at} editedAt={reply.edited_at} />
        </> : <p className="text-sm italic text-muted-foreground">This reply was removed.</p>}
      </li>
    </Fragment>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">No replies yet. Reply to keep this conversation with the Table.</p>}
    {open ? <ReplyForm threadId={threadId} groupId={groupId} tableName={tableName} aboutPlate={aboutPlate} photoUploadsReady={photosReady} /> : <p className="mt-5 text-sm text-muted-foreground">This conversation is closed to new replies. Existing replies remain readable to Table members.</p>}
  </section>;
}
