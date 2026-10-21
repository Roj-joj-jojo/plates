import { privateTablePlates } from "@/lib/supabase/social";
import { PrivatePlateNotice } from "@/components/people-list";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateRequestForm, PostTableMessageForm, SavePlateButton } from "@/components/connected-actions";
import { PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { menuPreviewSchemaReady } from "@/lib/supabase/menu-preview";
import { profileNames, profileUsernames, requestSchemaReady, signedInClient } from "@/lib/supabase/connected";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import { imagesForEntry, tableImages, tableImagesSchemaReady } from "@/lib/supabase/table-images";
import { contentControlAccess } from "@/lib/supabase/content-controls";
import { TableConversation } from "@/components/plates/table-conversation";
import { PictureAvatar } from "@/components/picture-avatar";
import { pictures } from "@/lib/supabase/pictures";
import type { TablePerson } from "@/components/table-members";
import { TableContentControls } from "@/components/content-controls";
import { ConversationMeta, ConversationTimestamp } from "@/components/conversation-meta";
import { conversationCount } from "@/lib/conversation-ux";
import { activityReceipts, tableActivityPeriod } from "@/lib/supabase/table-activity";
import { ActivityReadMarker } from "@/components/activity-read-marker";

export const metadata: Metadata = { title: "Table" };
export const dynamic = "force-dynamic";

export default async function TablePage({ params, searchParams }: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ entry?: string | string[] }>;
}) {
  const { groupId } = await params;
  const requestedEntry = (await searchParams).entry;
  const entryId = typeof requestedEntry === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedEntry)
    ? requestedEntry.toLowerCase() : null;
  const supabase = await signedInClient();
  const activityPeriod = await tableActivityPeriod(supabase, groupId);
  const { data: group, error: groupError } = await supabase.from("groups")
    .select("id, name").eq("id", groupId).eq("availability", "available").maybeSingle();
  if (groupError || !group) notFound();
  const controls = await contentControlAccess(supabase, groupId);
  const { data: memberData, error: memberError } = await supabase.rpc("table_members", { p_group_id: groupId });
  if (memberError) throw memberError;
  const members: TablePerson[] = memberData ?? [];
  const requestsReady = await requestSchemaReady(supabase);
  const { data: recentEntries, error: entriesError } = await supabase.from("timeline_content")
    .select("*")
    .eq("group_id", groupId)
    .order("position", { ascending: false }).limit(50);
  if (entriesError) throw entriesError;
  let entries = [...(recentEntries ?? [])];
  let linkedContext = false;
  if (entryId && !entries.some(entry => entry.id === entryId)) {
    const { data: mentionedEntry, error: mentionedEntryError } = await supabase.from("timeline_content")
      .select("*")
      .eq("id", entryId).eq("group_id", groupId).eq("kind", "message")
      .eq("availability", "available").maybeSingle();
    if (mentionedEntryError) throw mentionedEntryError;
    if (mentionedEntry) {
      const [earlier, later] = await Promise.all([
        supabase.from("timeline_content").select("*").eq("group_id", groupId).lt("position", mentionedEntry.position).order("position", { ascending: false }).limit(20),
        supabase.from("timeline_content").select("*").eq("group_id", groupId).gt("position", mentionedEntry.position).order("position", { ascending: true }).limit(20),
      ]);
      if (earlier.error || later.error) throw earlier.error ?? later.error;
      entries = [...(earlier.data ?? []), mentionedEntry, ...(later.data ?? [])];
      linkedContext = true;
    }
  }
  const shareIds = (entries ?? []).filter((entry) => entry.kind === "plate_share").map((entry) => entry.id);
  const requestIds = (entries ?? []).filter((entry) => entry.kind === "request").map((entry) => entry.id);
  const rootIds = [...shareIds, ...requestIds];
  const [{ data: shares, error: sharesError }, { data: requests, error: requestsError },
    { data: threads, error: threadsError }] = await Promise.all([
    shareIds.length ? supabase.from("plate_shares").select("entry_id, plate_id, plate_revision_at_share").in("entry_id", shareIds)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length ? supabase.from("requests").select("entry_id, question").in("entry_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    rootIds.length ? supabase.from("threads").select("id, root_entry_id").in("root_entry_id", rootIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sharesError || requestsError || threadsError) throw sharesError ?? requestsError ?? threadsError;
  const plateIds = (shares ?? []).map((share) => share.plate_id);
  const privateNotices = await privateTablePlates(supabase, groupId, plateIds);
  const { data: plates, error: platesError } = plateIds.length
    ? await supabase.from("plates").select("id, author_id, body, links, revision").in("id", plateIds)
    : { data: [], error: null };
  if (platesError) throw platesError;
  const photosReady = await plateImagesSchemaReady(supabase);
  const tablePhotosReady = await tableImagesSchemaReady(supabase);
  const tablePhotos = tablePhotosReady ? await tableImages(supabase, groupId) : [];
  const photos = new Map<string, Awaited<ReturnType<typeof plateImages>>>();
  if (photosReady) {
    await Promise.all((plates ?? []).map(async (plate) => {
      photos.set(plate.id, await plateImages(supabase, plate.id));
    }));
  }
  const names = await profileNames(supabase, [
    ...(entries ?? []).map((entry) => entry.author_id), ...(plates ?? []).map((plate) => plate.author_id),
  ]);
  const shareByEntry = new Map((shares ?? []).map((share) => [share.entry_id, share]));
  const requestByEntry = new Map((requests ?? []).map((request) => [request.entry_id, request]));
  const threadByEntry = new Map((threads ?? []).map((thread) => [thread.root_entry_id, thread]));
  const threadIds = (threads ?? []).map((thread) => thread.id);
  const { data: replies, error: repliesError } = threadIds.length
    ? await supabase.from("reply_content").select("thread_id, availability").in("thread_id", threadIds)
    : { data: [], error: null };
  if (repliesError) throw repliesError;
  const replyCounts = new Map<string, number>();
  for (const reply of replies ?? []) if (reply.availability === "available") replyCounts.set(reply.thread_id, (replyCounts.get(reply.thread_id) ?? 0) + 1);
  const plateById = new Map((plates ?? []).map((plate) => [plate.id, plate]));
  const { data: menuSaves, error: menuSavesError } = plateIds.length ? await supabase.from("menu_plate_saves").select("id,plate_id").in("plate_id",plateIds).eq("availability","available") : { data:[],error:null };
  if(menuSavesError) throw menuSavesError;
  const saveIds=(menuSaves ?? []).map(save=>save.id);
  const {data:savedSources,error:savedSourcesError}=saveIds.length ? await supabase.from("menu_plate_sources").select("share_entry_id").in("save_id",saveIds).in("share_entry_id",shareIds) : {data:[],error:null};
  if(savedSourcesError) throw savedSourcesError;
  const savedByPlate=new Set((menuSaves ?? []).map(save=>save.plate_id));
  const savedShareIds=new Set((savedSources ?? []).map(source=>source.share_entry_id));
  const previewsReady=await menuPreviewSchemaReady(supabase);
  entries.sort((left,right) => left.position-right.position);
  const memberById = new Map(members.map(member => [member.profile_id,member]));
  const usernames = await profileUsernames(supabase, entries.filter(entry => entry.availability === "available").map(entry => entry.author_id));
  const authorPictures = await pictures(supabase, "profile", [...members.map(member => member.profile_id), ...entries.map(entry => entry.author_id).filter(Boolean)]);
  const tablePicture = (await pictures(supabase, "table", [groupId])).get(groupId);
  const memberPanel = <><ul className="mt-4 space-y-3">{members.map(member=><li key={member.profile_id} className="flex items-center gap-3"><PictureAvatar name={member.display_name} url={authorPictures.get(member.profile_id)?.url} className="shrink-0" /><div className="min-w-0"><p className="truncate text-sm font-semibold" title={member.display_name}>{member.display_name}</p><p className="truncate text-meta text-muted-foreground">{member.username ? "@"+member.username : "Member"}{member.role === "owner" ? " · Admin" : ""}</p></div></li>)}</ul><Link href={"/tables/"+groupId+"/members"} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link underline">Manage Table</Link></>;
  const photoPanel = <><PlateImages compact images={tablePhotos.slice(-6)} label="Table"/><Link href={"/tables/"+groupId+"/images"} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link underline">View all Table photos</Link>{tablePhotos.length===0 && <p className="mt-3 text-sm text-muted-foreground">Photos shared here will appear in this space.</p>}</>;
  const receipts = await activityReceipts(supabase, groupId, activityPeriod, entries.filter(entry => entry.availability === "available"), [], true);
  return <TableConversation key={groupId} groupId={groupId} name={group.name} pictureUrl={tablePicture?.url} ids={entries.map(entry=>entry.id)} dates={entries.map(entry=>entry.created_at)} targetId={entryId}
    membershipRead={<ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.kind === "added").map(item => item.id)} />}
    linkedContext={linkedContext} unavailable={Boolean(entryId && !entries.some(entry=>entry.id===entryId))} memberCount={members.length} photoCount={tablePhotos.length}
    members={memberPanel} photos={photoPanel} requestForm={requestsReady ? <CreateRequestForm groupId={groupId} expanded/> : undefined}
    composer={<PostTableMessageForm groupId={groupId} photoUploadsReady={tablePhotosReady} compact/>}>
    {entries.map(entry => {
      const share = shareByEntry.get(entry.id);
      const request = requestByEntry.get(entry.id);
      const thread = threadByEntry.get(entry.id);
      const plate = share ? plateById.get(share.plate_id) : null;
      const name: string = names.get(entry.author_id) ?? "Former member";
      const person = memberById.get(entry.author_id);
      const available = entry.availability === "available";
      return <li key={entry.id} id={"entry-"+entry.id} data-message-id={entry.id} className="scroll-mt-6 rounded-lg">
        <article className="relative rounded-lg border border-border bg-card p-4 sm:p-5">
          {available && <ActivityReadMarker groupId={groupId} periodId={activityPeriod} ids={receipts.filter(item => item.entry_id === entry.id).map(item => item.id)} />}
          <div className="min-w-0 flex-1">
            {available && <ConversationMeta person={{ profileId: entry.author_id, name, username: person?.username ?? usernames.get(entry.author_id), pictureUrl: authorPictures.get(entry.author_id)?.url }} editedAt={entry.edited_at}
              actions={controls.ready && <TableContentControls placement="inline" authorName={name} id={entry.id} groupId={groupId} kind={entry.kind} body={entry.body} links={entry.links} hasPhotos={imagesForEntry(tablePhotos, entry.id).length > 0} question={request?.question} updatedAt={entry.updated_at} canEdit={entry.author_id===controls.profileId} canRemove={entry.author_id===controls.profileId || controls.canModerate}/>} />}
            {available ? <>
              <div className="[overflow-wrap:anywhere]"><PlateContent body={entry.body} links={entry.links} linkify/></div>
              {entry.kind === "message" && <PlateImages compact images={imagesForEntry(tablePhotos,entry.id)} label="Table"/>}
              {request && <div className="mt-2 rounded-lg border bg-card px-3.5 py-3"><p className="text-label text-link">Question for this Table</p><h2 className="mt-1 text-lg font-bold [overflow-wrap:anywhere]">{request.question}</h2></div>}
              {share && <div className="mt-2 rounded-lg border bg-card px-3.5 py-3"><p className="text-label text-link">Plate</p>{plate ? <><p className="mt-1 text-meta text-muted-foreground">By {names.get(plate.author_id) ?? "Former member"}{plate.revision>share.plate_revision_at_share ? " · Edited since shared" : ""}</p><div className="mt-2"><PlateContent body={plate.body} links={plate.links}/></div><PlateImages compact images={photos.get(plate.id) ?? []}/><Link href={"/feed/"+plate.id} className="mt-2 inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline underline-offset-4 hover:text-link">View plate</Link>{(previewsReady || savedByPlate.has(plate.id) || !photos.get(plate.id)?.length) && <SavePlateButton compact plateId={plate.id} revision={plate.revision} shareId={entry.id} saved={savedByPlate.has(plate.id)} sourceSaved={savedShareIds.has(entry.id)} hasPhotos={Boolean(photos.get(plate.id)?.length)}/>}</> : privateNotices.has(share.plate_id) ? <PrivatePlateNotice authorId={privateNotices.get(share.plate_id)!} /> : <p className="mt-2 text-sm text-muted-foreground">This Plate is no longer available. Its Table discussion remains readable.</p>}</div>}
              <ConversationTimestamp at={entry.created_at} editedAt={entry.edited_at} />
            </> : <p className="rounded-md border border-border bg-card px-3 py-2 text-sm italic text-muted-foreground">{entry.kind === "request" ? "This question was removed." : entry.kind === "plate_share" ? "This share was removed." : "This message was removed."}</p>}
            {thread && <div className="mt-2 border-t pt-2"><Link href={request ? "/tables/"+groupId+"/requests/"+entry.id : "/tables/"+groupId+"/discussion/"+entry.id} className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline underline-offset-4 hover:text-link">{request ? "View question and replies" : "View Table replies"}{" · "+conversationCount(replyCounts.get(thread.id) ?? 0, "active reply", "active replies")}</Link>{!available && <p className="text-meta text-muted-foreground">Existing replies stay readable. New replies are closed.</p>}</div>}
          </div>
        </article>
      </li>;
    })}
  </TableConversation>;
}
