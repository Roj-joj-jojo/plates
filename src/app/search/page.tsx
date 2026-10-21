import type { Metadata } from "next";
import Link from "next/link";
import { PlateContent } from "@/components/plate-content";
import { SearchForm } from "@/components/search-form";
import { PageLayout } from "@/components/page-layout";
import { signedInClient } from "@/lib/supabase/connected";
import { socialReady, type SocialPerson } from "@/lib/supabase/social";
import { PeopleList } from "@/components/people-list";
import { plateImages, plateImagesSchemaReady } from "@/lib/supabase/plate-images";
import { PlateImages } from "@/components/plate-images";
import { plateDestination } from "@/lib/navigation-ux";
import { ViewNavigation } from "@/components/view-navigation";
import { MANAGE_PEOPLE } from "@/lib/ui-copy";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";
type PlateResult = {
  id: string; author_name: string | null; category_label: string;
  body: string; links: unknown;
};

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; type?: string; offset?: string }>;
}) {
  const supabase = await signedInClient();
  const params = await searchParams;
  const raw = params.q;
  const peopleMode = params.type === "people";
  const offset = Math.min(10000, Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0));
  const ready = await socialReady(supabase);
  const query = typeof raw === "string" ? raw.trim() : "";
  const valid = query.length > 0 && query.length <= 100;
  const { data: plates, error } = valid && !peopleMode
    ? await supabase.rpc("search_plates", { p_query: query })
    : { data: [], error: null };
  if (error) throw error;
  const results = (plates ?? []) as PlateResult[];
  const photos = valid && !peopleMode && results.length && await plateImagesSchemaReady(supabase)
    ? await Promise.all(results.map(result => plateImages(supabase, result.id, 1))) : [];
  const returnHref = `/search?type=plates&q=${encodeURIComponent(query)}`;
  const people = valid && peopleMode && ready
    ? await supabase.rpc("search_people", { p_query: query, p_offset: offset }) : { data: [], error: null };
  if (people.error) throw people.error;
  const personResults = (people.data ?? []) as SocialPerson[];
  return <PageLayout title="Search" description="Find a dish, ingredient, place or person.">
    <ViewNavigation label="Search type" items={["plates", "people"].map(type => ({ href: `/search?type=${type}&q=${encodeURIComponent(query)}`, label: type === "people" ? "People" : "Plates", active: (peopleMode ? "people" : "plates") === type }))} />
    <SearchForm action="/search" query={query} hiddenFields={{ type: peopleMode ? "people" : "plates" }} placeholder={peopleMode ? "Name or @username" : "Dish, ingredient, place or author"} />
    {ready && <Link href="/people" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link underline">{MANAGE_PEOPLE}</Link>}
    {query.length > 100 && <p role="alert" className="mt-4 text-sm text-destructive">Use at most 100 characters.</p>}
    {peopleMode && !ready && <p className="mt-4 text-sm text-muted-foreground">People search is not available yet. Please try again later.</p>}
    {peopleMode && ready && valid && <section className="mt-8"><h2 className="font-display text-xl font-bold">People matching “{query}”</h2>
      {personResults.length ? <PeopleList client={supabase} people={personResults} /> : <p className="mt-4 text-sm text-muted-foreground">No people matched. Try their name or username.</p>}
      <nav aria-label="People search pages" className="mt-4 flex gap-6">
        {offset > 0 && <Link className="inline-flex min-h-11 items-center text-link underline" href={`/search?type=people&q=${encodeURIComponent(query)}&offset=${Math.max(0, offset - 30)}`}>Previous</Link>}
        {personResults.length === 30 && offset < 10000 && <Link className="inline-flex min-h-11 items-center text-link underline" href={`/search?type=people&q=${encodeURIComponent(query)}&offset=${offset + 30}`}>More people</Link>}
      </nav>
    </section>}
    {valid && !peopleMode && <section className="mt-8"><h2 className="text-xl font-semibold">Results for “{query}”</h2>
      {results.length ? <ul className="mt-4 space-y-4">{results.map((plate, index) => <li key={plate.id} id={`plate-${plate.id}`} className="scroll-mt-6 rounded-2xl border border-border bg-card p-6">
        <p className="mb-3 text-sm text-muted-foreground">{plate.author_name ?? "Former member"} · {plate.category_label}</p>
        <PlateContent body={plate.body} links={plate.links} />
        <PlateImages compact images={photos[index]?.slice(0, 1) ?? []} />
        <Link href={plateDestination(plate.id, `${returnHref}#plate-${plate.id}`)} className="mt-4 inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline hover:text-link">View plate</Link>
      </li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No Plates matched. Try another word or name.</p>}
      {results.length === 50 && <p className="mt-4 text-sm text-muted-foreground">Showing the 50 most recent matches.</p>}
    </section>}
  </PageLayout>;
}
