import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { PersonName } from "@/components/person-name";
import { signedInClient } from "@/lib/supabase/connected";
import { myTableActivity } from "@/lib/supabase/table-activity";
import { conversationCount, conversationStamp } from "@/lib/conversation-ux";

export const dynamic = "force-dynamic";
export const metadata = { title: "Table activity" };
const labels: Record<string, string> = { added: "added you to the Table", message: "posted a message", question: "asked a question", share: "shared a Plate", reply: "replied in the Table", mention: "mentioned you" };
export default async function ActivityPage() {
  const client = await signedInClient();
  let items;
  try { items = await myTableActivity(client); } catch {
    return <PageLayout title="Table activity"><p role="alert" className="text-sm text-destructive">Couldn’t load Table activity. Please refresh to try again.</p></PageLayout>;
  }
  return <PageLayout title="Table activity" description="Unread updates from your private Tables. Opening this list keeps them unread; they clear as you view the relevant conversation.">
    {items === null ? <p className="text-sm text-muted-foreground">Table activity is temporarily unavailable. <Link href="/tables" className="text-link underline">Open your Tables</Link></p> : items.length ? <ul className="space-y-4">{items.map(item => <li key={item.group_id} className="rounded-lg border bg-card p-5">
      <h2 className="font-display text-xl font-bold">{item.table_name}</h2>
      <p className="mt-2 text-sm font-semibold">{conversationCount(item.unread_count, "unread update")}{item.mention_count > 0 ? ` · ${conversationCount(item.mention_count, "mention")}` : ""}</p>
      <p className="mt-3 text-sm"><PersonName name={item.sender_name} username={item.sender_username} /><span className="mt-1 block">{labels[item.kind] ?? "updated the Table"}.</span></p>
      <p className="mt-2 text-xs text-muted-foreground">{conversationStamp(item.created_at).full}</p>
      <Link href={item.destination} className="mt-3 inline-flex min-h-11 items-center font-semibold text-link underline">Open latest update</Link>
      <Link href={`/tables/${item.group_id}`} className="ml-4 inline-flex min-h-11 items-center text-sm text-link underline">Open Table</Link>
    </li>)}</ul> : <p className="text-sm text-muted-foreground">You’re up to date. New Table messages, replies, mentions and additions will appear here.</p>}
  </PageLayout>;
}
