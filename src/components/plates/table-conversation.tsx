"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Users, ImageIcon, MessageCircle, ChevronDown } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { PageHeader } from "@/components/page-layout";
import { PictureAvatar } from "@/components/picture-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useThreadScroll } from "@/hooks/use-thread-scroll";
import { useVisualViewportVars } from "@/hooks/use-visual-viewport";
import { ConversationDay } from "@/components/conversation-meta";
import { conversationCount, startsConversationDay } from "@/lib/conversation-ux";

type Props = { groupId:string; name:string; pictureUrl?:string|null; ids:string[]; dates:string[]; targetId:string|null; children:React.ReactNode;
  composer:React.ReactNode; members:React.ReactNode; memberCount:number; photos:React.ReactNode; photoCount:number; requestForm?:React.ReactNode; unavailable?:boolean; membershipRead?:React.ReactNode; linkedContext?:boolean };
export function TableConversation(p:Props) {
  const router = useRouter();
  useVisualViewportVars();
  const scrollerId = React.useId();
  const { ref: threadRef, contentRef, unseen, jumpToLatest, scrollToBottomNow } = useThreadScroll(p.ids,{ navigationTargetId:p.targetId ?? undefined });
  React.useEffect(() => {
    const posted = (event:Event) => {
      if ((event as CustomEvent).detail !== p.groupId) return;
      if (p.linkedContext) router.push(`/tables/${p.groupId}`);
      else scrollToBottomNow();
    };
    window.addEventListener("plates:message-posted",posted);
    return () => window.removeEventListener("plates:message-posted",posted);
  },[p.groupId,p.linkedContext,router,scrollToBottomNow]);
  React.useEffect(() => { if (!p.targetId) scrollToBottomNow(); }, [p.targetId,scrollToBottomNow]);
  const rows=React.Children.toArray(p.children);
  return <div id={scrollerId} className="table-design fixed inset-x-0 top-[var(--vv-top,0px)] flex h-[var(--vvh,100dvh)] overflow-hidden bg-background">
    <aside className="hidden w-[200px] shrink-0 flex-col border-r px-4 py-6 thread:flex"><Link href="/feed" aria-label="Plates home" className="mb-8 px-3 font-display text-2xl font-bold">Plates<span className="text-primary">.</span></Link><Navigation vertical/><p className="mt-auto px-3 pt-8 text-meta text-muted-foreground">Food is worth sharing.</p></aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="shrink-0"><PageHeader title={p.name} description={`${conversationCount(p.memberCount, "member")} · ${conversationCount(p.photoCount, "photo")}`} readMarker={p.membershipRead}
        leading={<><Link href="/tables" aria-label="All Tables" className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-card/10"><ArrowLeft className="size-4" aria-hidden/></Link><PictureAvatar name={p.name} url={p.pictureUrl} table className="hidden size-12 shrink-0 sm:flex" /></>} /></div>
        <div className="table-tools shrink-0 border-b bg-background"><div className="mx-auto flex max-w-thread flex-wrap justify-end gap-1 px-4 py-2 thread:px-6">
          <Link href={"/tables/"+p.groupId+"/search"} aria-label="Search this Table" className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"><Search className="size-4" aria-hidden/></Link>
          <Sheet><SheetTrigger asChild><Button variant="ghost"><Users className="size-4" aria-hidden/>Members</Button></SheetTrigger><SheetContent><SheetTitle className="font-display text-xl font-bold">Table members</SheetTitle><SheetDescription className="mt-2 text-sm text-muted-foreground">People sat at the Table.</SheetDescription>{p.members}</SheetContent></Sheet>
          <Sheet><SheetTrigger asChild><Button variant="ghost"><ImageIcon className="size-4" aria-hidden/>Photos</Button></SheetTrigger><SheetContent><SheetTitle className="font-display text-xl font-bold">Table photos</SheetTitle><SheetDescription className="mt-2 text-sm text-muted-foreground">Photos from this Table and its shared Plates.</SheetDescription>{p.photos}</SheetContent></Sheet>
          {p.requestForm && <Sheet><SheetTrigger asChild><Button variant="ghost"><MessageCircle className="size-4" aria-hidden/>Ask the Table</Button></SheetTrigger><SheetContent><SheetTitle className="font-display text-xl font-bold">Ask the Table</SheetTitle><SheetDescription className="mt-2 text-sm text-muted-foreground">Ask a question with its own replies, visible only to this Table. Save a question to Menu as a Request.</SheetDescription>{p.requestForm}</SheetContent></Sheet>}
        </div></div>
      <section ref={threadRef} aria-label="Table conversation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="mx-auto max-w-thread px-4 py-5 thread:px-6">
          {p.unavailable && <p role="status" className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">The linked message is no longer available in this Table.</p>}
          {p.linkedContext && <p role="status" className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">Showing the linked message with up to 20 earlier and 20 later entries. <Link href={`/tables/${p.groupId}`} className="font-semibold text-link underline">Back to latest messages</Link></p>}
          {p.ids.length ? <ol className="space-y-3">{rows.map((row,index)=><React.Fragment key={p.ids[index] ?? index}>{startsConversationDay(p.dates[index], p.dates[index - 1]) && <li><ConversationDay at={p.dates[index]} /></li>}{unseen > 0 && index === p.ids.length-unseen && <li className="flex items-center gap-3 py-2 text-meta font-semibold"><span className="h-0.5 flex-1 bg-unread"/><span className="rounded-sm bg-unread px-3 py-1 text-unread-foreground">New messages</span><span className="h-0.5 flex-1 bg-unread"/></li>}{row}</React.Fragment>)}</ol> : <div className="py-16 text-center"><h2 className="font-display text-xl font-bold">No messages yet</h2><p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">Say hello, share a Plate or ask the Table a question.</p><Button asChild variant="outline" className="mt-5"><Link href="/feed">Find a Plate to share</Link></Button></div>}
        </div>
      </section>
      {unseen > 0 && <div className="border-t px-4 py-2 text-center"><Button variant="secondary" onClick={jumpToLatest}><ChevronDown className="size-4" aria-hidden/>{unseen} new message{unseen===1?"":"s"}</Button></div>}
      <span className="sr-only" aria-live="polite" aria-atomic="true">{unseen ? conversationCount(unseen, "new message") : ""}</span>
      <div className="shrink-0">{p.composer}</div>
      <div className="table-tabs shrink-0 border-t px-1 thread:hidden"><Navigation compact/></div>
    </div>
    <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-l px-5 py-6 wide:block"><h2 className="font-display text-lg font-bold">People sat at the Table</h2>{p.members}<h2 className="mt-8 font-display text-lg font-bold">Recent photos</h2>{p.photos}</aside>
  </div>;
}
