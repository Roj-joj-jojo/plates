import type { Metadata } from "next";
import Link from "next/link";
import { ViewNavigation } from "@/components/view-navigation";
import { PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { SearchForm } from "@/components/search-form";
import { PageLayout } from "@/components/page-layout";
import { requestSchemaReady, signedInClient } from "@/lib/supabase/connected";
import { menuPreviews, menuPreviewSchemaReady } from "@/lib/supabase/menu-preview";
import { menuRemovalReady } from "@/lib/supabase/menu-removal";
import { MenuItemActions } from "@/components/menu-item-actions";
import { plateDestination } from "@/lib/navigation-ux";

export const metadata: Metadata = { title: "Menu" };
export const dynamic = "force-dynamic";
type MenuHit = { save_type: "plate" | "request"; save_id: string };

export default async function MenuPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; view?: string; notice?: string; undoKind?: string; undoId?: string; undoVersion?: string }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const query = typeof raw === "string" ? raw.trim() : "";
  const searching = query.length > 0;
  const valid = searching && query.length <= 100;
  const supabase = await signedInClient();
  const removalReady = await menuRemovalReady(supabase);
  const removedView = params.view === "removed";
  const undoVersion = Number(params.undoVersion);
  const undoKind = params.undoKind === "plate" || params.undoKind === "request" ? params.undoKind : null;
  const undoId = typeof params.undoId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.undoId) ? params.undoId : null;
  const { data: hits, error: hitsError } = valid
    ? removalReady ? await supabase.rpc("search_menu_items", { p_query: query, p_removed: removedView })
      : await supabase.rpc("search_menu", { p_query: query })
    : { data: [], error: null };
  if (hitsError) throw hitsError;
  const menuHits = (hits ?? []) as MenuHit[];
  const plateHitIds = menuHits.filter((hit) => hit.save_type === "plate").map((hit) => hit.save_id);
  const requestHitIds = menuHits.filter((hit) => hit.save_type === "request").map((hit) => hit.save_id);
  let plateSaveQuery = supabase.from("menu_plate_saves")
    .select("id, plate_id, snapshot_revision, snapshot_body, snapshot_links, snapshot_category_label, snapshot_author_name, saved_at")
    .eq("availability", "available").order("saved_at", { ascending: false });
  if (removalReady) plateSaveQuery = removedView ? plateSaveQuery.not("removed_at", "is", null) : plateSaveQuery.is("removed_at", null);
  plateSaveQuery = plateSaveQuery.limit(50);
  const { data: saves, error } = removedView && !removalReady ? { data: [], error: null } : searching
    ? valid && plateHitIds.length ? await plateSaveQuery.in("id", plateHitIds) : { data: [], error: null }
    : await plateSaveQuery;
  if (error) throw error;
  const ids = (saves ?? []).map((save) => save.id);
  const previewsReady = await menuPreviewSchemaReady(supabase);
  const previews = previewsReady ? await Promise.all(ids.map((id) => menuPreviews(supabase, id))) : [];
  const previewBySave = new Map(ids.map((id, index) => [id, previews[index]]));
  const { data: sources, error: sourcesError } = ids.length
    ? await supabase.from("menu_source_context")
      .select("save_id, share_entry_id, group_id, group_name, sharer_name, thread_id, source_available").in("save_id", ids)
    : { data: [], error: null };
  if (sourcesError) throw sourcesError;
  const plateIds = (saves ?? []).map((save) => save.plate_id);
  const { data: currentPlates, error: currentPlatesError } = plateIds.length
    ? await supabase.from("plates").select("id, revision").in("id", plateIds)
    : { data: [], error: null };
  if (currentPlatesError) throw currentPlatesError;
  const availablePlateIds = new Set((currentPlates ?? []).map((plate) => plate.id));
  // The plates query retains RLS: inaccessible originals disclose no revision.
  const currentRevisions = new Map((currentPlates ?? []).map(plate => [plate.id, Number(plate.revision)]));
  const requestsReady = await requestSchemaReady(supabase);
  let requestSaveQuery = supabase.from("menu_request_context")
      .select("save_id, request_entry_id, saved_at, group_id, group_name, asker_name, question, context, links, thread_id, source_available")
      .order("saved_at", { ascending: false });
  if (removalReady) requestSaveQuery = removedView ? requestSaveQuery.not("removed_at", "is", null) : requestSaveQuery.is("removed_at", null);
  requestSaveQuery = requestSaveQuery.limit(50);
  const { data: requestSaves, error: requestSavesError } = requestsReady && (!removedView || removalReady)
    ? searching
      ? valid && requestHitIds.length ? await requestSaveQuery.in("save_id", requestHitIds) : { data: [], error: null }
      : await requestSaveQuery
    : { data: [], error: null };
  if (requestSavesError) throw requestSavesError;
  const requestIds = (requestSaves ?? []).map(save => save.save_id);
  const [plateState, requestState] = await Promise.all([
    removalReady && ids.length ? supabase.from("menu_plate_saves").select("id,menu_version").in("id", ids) : Promise.resolve({ data: [], error: null }),
    removalReady && requestIds.length ? supabase.from("menu_request_saves").select("id,menu_version").in("id", requestIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (plateState.error) throw plateState.error;
  if (requestState.error) throw requestState.error;
  const plateVersions = new Map((plateState.data ?? []).map(item => [item.id, Number(item.menu_version)]));
  const requestVersions = new Map((requestState.data ?? []).map(item => [item.id, Number(item.menu_version)]));
  const requestThreadIds = (requestSaves ?? []).flatMap((save) => save.thread_id ? [save.thread_id] : []);
  const { data: requestReplies, error: requestRepliesError } = requestThreadIds.length
    ? await supabase.from("reply_content").select("thread_id").in("thread_id", requestThreadIds)
    : { data: [], error: null };
  if (requestRepliesError) throw requestRepliesError;
  const requestReplyCounts = new Map<string, number>();
  for (const reply of requestReplies ?? []) {
    requestReplyCounts.set(reply.thread_id, (requestReplyCounts.get(reply.thread_id) ?? 0) + 1);
  }
  const sourcesBySave = new Map<string, Array<{
    save_id: string; share_entry_id: string; group_id: string | null;
    group_name: string | null; sharer_name: string | null;
    thread_id: string | null; source_available: boolean;
  }>>();
  for (const source of sources ?? []) {
    const list = sourcesBySave.get(source.save_id) ?? [];
    list.push(source);
    sourcesBySave.set(source.save_id, list);
  }
  return (
    <PageLayout title={removedView ? "Removed items" : "Your Menu"} description={removedView ? "Restore saved items whenever you want. Original access rules still apply." : "Your saved Plates and Table Requests, ready to revisit."}>
      {removalReady && <ViewNavigation label="Menu views" items={[
        { href: query ? `/menu?q=${encodeURIComponent(query)}` : "/menu", label: "Your Menu", active: !removedView },
        { href: `/menu?view=removed${query ? `&q=${encodeURIComponent(query)}` : ""}`, label: "Removed items", active: removedView },
      ]} />}
      {removalReady && params.notice === "removed" && undoKind && undoId && Number.isSafeInteger(undoVersion) && undoVersion>0 &&
        <div role="status" className="mt-4 rounded-lg border bg-muted p-4"><p>Item removed from your Menu. You can also restore it from Removed items.</p>
          <MenuItemActions kind={undoKind} saveId={undoId} removed version={undoVersion} undo />
        </div>}
      {removalReady && params.notice === "restored" && <p role="status" className="mt-4 rounded-lg border bg-muted p-4">Item restored to your Menu. <Link href="/menu" className="font-semibold text-link underline">View your Menu</Link></p>}
      <SearchForm action="/menu" query={query} label={removedView ? "Search removed items" : "Search your Menu"} placeholder="Saved dish, author or question" hiddenFields={removedView ? { view: "removed" } : {}} />
      {query.length > 100 && <p role="alert" className="mt-4 text-sm text-destructive">Use at most 100 characters.</p>}
      {valid && <p className="mt-6 text-sm text-muted-foreground">Menu results for “{query}”</p>}
      {saves?.length ? <ul className="mt-8 space-y-4">{saves.map((save) => <li key={save.id} id={`save-${save.id}`} className="scroll-mt-6 rounded-lg border border-border bg-card p-4 sm:p-6">
        <p className="mb-1 text-label text-link">Saved Plate</p>
        <p className="mb-3 text-sm text-muted-foreground">{save.snapshot_author_name} · {save.snapshot_category_label}</p>
        <p className="mb-3 text-xs text-muted-foreground">Saved copy · edits to the original don’t update this copy.</p>
        {(currentRevisions.get(save.plate_id) ?? 0) > Number(save.snapshot_revision) && <p className="mb-3 text-sm text-muted-foreground">Original edited since you saved. Your saved copy is unchanged.</p>}
        <PlateContent body={save.snapshot_body} links={save.snapshot_links} />
        {!!previewBySave.get(save.id)?.length && <PlateImages images={previewBySave.get(save.id)!} />}
        {availablePlateIds.has(save.plate_id)
          ? <Link href={plateDestination(save.plate_id, `/menu?q=${encodeURIComponent(query)}${removedView ? "&view=removed" : ""}#save-${save.id}`)} className="mt-4 inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline hover:text-link">View current plate</Link>
          : <p className="mt-4 text-sm text-muted-foreground">Original Plate no longer available.</p>}
        {(sourcesBySave.get(save.id) ?? []).length > 0 && <div className="mt-5 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">Table discussions linked to this Plate</h2>
          <ul className="mt-2 space-y-2 text-sm">{(sourcesBySave.get(save.id) ?? []).map((source) => <li key={source.share_entry_id}>
            {source.source_available && source.group_id && source.thread_id
              ? <Link href={`/tables/${source.group_id}/discussion/${source.share_entry_id}`} className="text-link underline">{source.group_name} · shared by {source.sharer_name} · View Table discussion</Link>
              : <span className="text-muted-foreground">Source discussion unavailable with your current Table access</span>}
          </li>)}</ul>
        </div>}
        {removalReady && <MenuItemActions kind="plate" saveId={save.id} removed={removedView} version={plateVersions.get(save.id) ?? 0} />}
      </li>)}</ul> : null}
      {requestSaves?.length ? <section className="mt-10"><h2 className="font-display text-xl font-bold">Saved Requests</h2>
        <ul className="mt-4 space-y-4">{requestSaves.map((save) => <li key={save.save_id} className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <p className="mb-2 text-label text-link">Saved Request</p>
          {save.source_available && save.group_id && save.thread_id ? <>
            <p className="mb-2 text-sm text-muted-foreground">Asked by {save.asker_name ?? "Former member"} · {save.group_name}</p>
            <h3 className="text-lg font-semibold">{save.question}</h3>
            {(save.context || (Array.isArray(save.links) && save.links.length > 0)) &&
              <div className="mt-3"><PlateContent body={save.context ?? ""} links={save.links} /></div>}
            {requestReplyCounts.get(save.thread_id) ? <p className="mt-3 text-sm text-muted-foreground">{requestReplyCounts.get(save.thread_id)} replies</p> : null}
            <Link href={`/tables/${save.group_id}/requests/${save.request_entry_id}`}
              className="mt-4 inline-block text-sm font-semibold text-link underline">Open current discussion</Link>
          </> : <p className="text-sm text-muted-foreground">Request discussion unavailable with your current Table access.</p>}
          {removalReady && <MenuItemActions kind="request" saveId={save.save_id} removed={removedView} version={requestVersions.get(save.save_id) ?? 0} />}
        </li>)}</ul>
      </section> : null}
      {!saves?.length && !requestSaves?.length && <p className="mt-8 text-sm text-muted-foreground">{searching ? "No saved items matched. Try another word." : removedView ? "No removed items." : "Nothing saved yet. Open a Plate or Table Request to save one."}</p>}
      {searching && <Link href={removedView ? "/menu?view=removed" : "/menu"} className="mt-5 inline-block text-sm font-semibold text-link underline">Show all {removedView ? "removed" : "saved"} items</Link>}
    </PageLayout>
  );
}
