import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, PlateContent } from "@/components/plate-content";
import { SearchForm } from "@/components/search-form";
import { PageLayout } from "@/components/page-layout";
import { signedInClient } from "@/lib/supabase/connected";
import { tableResultDestination } from "@/lib/navigation-ux";

export const metadata: Metadata = { title: "Search Table" };
export const dynamic = "force-dynamic";
type TableResult = {
  kind: string; root_kind: string; entry_id: string; reply_id: string | null;
  author_name: string | null; body: string; links: unknown; question: string | null;
};

export default async function TableSearchPage({ params, searchParams }: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { groupId } = await params;
  const raw = (await searchParams).q;
  const query = typeof raw === "string" ? raw.trim() : "";
  const valid = query.length > 0 && query.length <= 100;
  const supabase = await signedInClient();
  const { data: group, error: groupError } = await supabase.from("groups")
    .select("id, name").eq("id", groupId).eq("availability", "available").maybeSingle();
  if (groupError || !group) notFound();
  const { data: results, error } = valid
    ? await supabase.rpc("search_table", { p_group_id: groupId, p_query: query })
    : { data: [], error: null };
  if (error) throw error;
  const hits = (results ?? []) as TableResult[];
  return <PageLayout title={`Search ${group.name}`} description="Find messages, questions, shared Plates and replies." backLink={<BackLink href={`/tables/${groupId}`}>{group.name}</BackLink>}>
    <SearchForm action={`/tables/${groupId}/search`} query={query} placeholder="A question, recommendation or name" />
    {query.length > 100 && <p role="alert" className="mt-4 text-sm text-destructive">Use at most 100 characters.</p>}
    {valid && <section className="mt-8"><h2 className="text-xl font-semibold">Results for “{query}”</h2>
      {hits.length ? <ul className="mt-4 space-y-4">{hits.map((result) => {
        const href = tableResultDestination(groupId, result.root_kind, result.entry_id, result.reply_id);
        const label = result.kind === "reply" ? "Discussion reply"
          : result.kind === "request" ? "Question"
            : result.kind === "plate_share" ? "Shared Plate" : "Message";
        return <li key={result.reply_id ?? result.entry_id} className="rounded-2xl border border-border bg-card p-6">
          <p className="mb-2 text-sm text-muted-foreground">{label} · {result.author_name ?? "Former member"}</p>
          {result.kind === "request" && result.question && <h3 className="mb-2 text-lg font-semibold">{result.question}</h3>}
          <PlateContent body={result.body} links={result.links} />
          {result.kind === "reply" && result.question && <p className="mt-3 text-sm text-muted-foreground">In response to: {result.question}</p>}
          <Link href={href} className="mt-4 inline-block text-sm font-semibold text-link underline">
            {result.kind === "message" ? "View in Table" : "Open discussion"}
          </Link>
        </li>;
      })}</ul> : <p className="mt-4 text-sm text-muted-foreground">No results in this Table.</p>}
      {hits.length === 50 && <p className="mt-4 text-sm text-muted-foreground">Showing the 50 most recent matches.</p>}
    </section>}
  </PageLayout>;
}
