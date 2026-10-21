import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/plate-content";
import { PageLayout } from "@/components/page-layout";
import { PlateImages } from "@/components/plate-images";
import { profileNames, signedInClient } from "@/lib/supabase/connected";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import { tableImages, tableImagesSchemaReady, type TableImage } from "@/lib/supabase/table-images";

export const metadata: Metadata = { title: "Table images" };
export const dynamic = "force-dynamic";

export default async function TableImagesPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await signedInClient();
  const { data: group, error: groupError } = await supabase.from("groups")
    .select("id, name").eq("id", groupId).eq("availability", "available").maybeSingle();
  if (groupError || !group) notFound();
  const ready = await plateImagesSchemaReady(supabase);
  const tableReady = await tableImagesSchemaReady(supabase);
  const nativePhotos = tableReady ? await tableImages(supabase, groupId) : [];
  const nativeGroups = new Map<string, TableImage[]>();
  for (const photo of nativePhotos) {
    const key = photo.entryId ? `entry:${photo.entryId}` : `reply:${photo.replyId}`;
    nativeGroups.set(key, [...(nativeGroups.get(key) ?? []), photo]);
  }
  const nativeOccurrences = [...nativeGroups.entries()].sort((left, right) =>
    right[1][0].occurredAt.localeCompare(left[1][0].occurredAt));
  const replyIds = [...new Set(nativePhotos.flatMap((photo) => photo.replyId ? [photo.replyId] : []))];
  const { data: photoReplies, error: photoRepliesError } = replyIds.length
    ? await supabase.from("reply_content").select("id, thread_id").in("id", replyIds)
    : { data: [], error: null };
  if (photoRepliesError) throw photoRepliesError;
  const photoThreadIds = [...new Set((photoReplies ?? []).map((reply) => reply.thread_id))];
  const { data: photoThreads, error: photoThreadsError } = photoThreadIds.length
    ? await supabase.from("threads").select("id, root_entry_id, root_kind").in("id", photoThreadIds)
    : { data: [], error: null };
  if (photoThreadsError) throw photoThreadsError;
  const threadById = new Map((photoThreads ?? []).map((thread) => [thread.id, thread]));
  const sourceByReply = new Map((photoReplies ?? []).map((reply) => [reply.id, threadById.get(reply.thread_id)]));
  const { data: entries, error: entriesError } = await supabase.from("timeline_content")
    .select("id, author_id, created_at").eq("group_id", groupId)
    .eq("kind", "plate_share").eq("availability", "available")
    .order("position", { ascending: false }).limit(100);
  if (entriesError) throw entriesError;
  const ids = (entries ?? []).map((entry) => entry.id);
  const { data: shares, error: sharesError } = ids.length
    ? await supabase.from("plate_shares").select("entry_id, plate_id").in("entry_id", ids)
    : { data: [], error: null };
  if (sharesError) throw sharesError;
  const shareByEntry = new Map((shares ?? []).map((share) => [share.entry_id, share]));
  const names = await profileNames(supabase, (entries ?? []).map((entry) => entry.author_id));
  const photos = new Map<string, Awaited<ReturnType<typeof plateImages>>>();
  if (ready) {
    await Promise.all([...new Set((shares ?? []).map((share) => share.plate_id))].map(async (plateId) => {
      photos.set(plateId, await plateImages(supabase, plateId));
    }));
  }
  const occurrences = (entries ?? []).flatMap((entry) => {
    const share = shareByEntry.get(entry.id);
    if (!share) return [];
    const images = photos.get(share.plate_id) ?? [];
    return images.length ? [{ entry, share, images }] : [];
  });
  return <PageLayout title={<>Photos in {group.name}</>} description="Photos from this Table’s messages, replies and shared Plates." backLink={<BackLink href={`/tables/${groupId}`}>{group.name}</BackLink>}>
    {nativeOccurrences.length > 0 && <section className="mt-6">
      <h2 className="text-xl font-semibold">Table conversation</h2>
      <ul className="mt-4 space-y-5">{nativeOccurrences.map(([key, images]) => {
        const entryId = images[0].entryId;
        const source = images[0].replyId ? sourceByReply.get(images[0].replyId) : null;
        const href = entryId ? `/tables/${groupId}/messages/${entryId}`
          : source ? source.root_kind === "request"
            ? `/tables/${groupId}/requests/${source.root_entry_id}`
            : `/tables/${groupId}/discussion/${source.root_entry_id}` : null;
        return <li key={key} className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{entryId ? "Table message" : "Discussion reply"}</p>
          <PlateImages images={[...images].sort((left, right) => left.position - right.position)} label="Table" />
          {href && <Link href={href} className="mt-4 inline-block text-sm font-semibold text-link underline">
            {entryId ? "Open message" : "View discussion"}</Link>}
        </li>;
      })}</ul>
    </section>}
    {occurrences.length > 0 && <section className="mt-8"><h2 className="text-xl font-semibold">Shared Plates</h2>
      <ul className="mt-4 space-y-5">{occurrences.map(({ entry, images }) =>
      <li key={entry.id} className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Shared by {names.get(entry.author_id) ?? "Former member"}</p>
        <PlateImages images={images} />
        <Link href={`/tables/${groupId}/discussion/${entry.id}`}
          className="mt-4 inline-block text-sm font-semibold text-link underline">View Table discussion</Link>
      </li>)}</ul></section>}
    {nativeOccurrences.length === 0 && occurrences.length === 0 &&
      <p className="mt-6 text-sm text-muted-foreground">No photos in this Table yet.</p>}
  </PageLayout>;
}
