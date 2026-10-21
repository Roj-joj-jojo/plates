import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { PeopleList } from "@/components/people-list";
import { signedInClient } from "@/lib/supabase/connected";
import { socialReady, type SocialPerson } from "@/lib/supabase/social";
import { ViewNavigation } from "@/components/view-navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your people" };
const lists = { following: "Following", requests: "Requests", followers: "Followers", sent: "Sent requests" };
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ list?: string; offset?: string }> }) {
  const client = await signedInClient();
  const params = await searchParams;
  const list = params.list && params.list in lists ? params.list as keyof typeof lists : "following";
  const offset = Math.min(10000, Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0));
  if (!await socialReady(client)) return <PageLayout title="Your people"><p>Following is not available yet. Please try again later.</p></PageLayout>;
  const { data, error } = await client.rpc("my_social_people", { p_list: list, p_offset: offset });
  if (error) throw error;
  const people = (data ?? []) as SocialPerson[];
  const counts = await client.rpc("social_counts");
  if (counts.error) throw counts.error;
  const requestCount = Number(counts.data?.[0]?.requests ?? 0);
  const requestsView = list === "requests" || list === "sent";
  return <PageLayout title="Your people" description="Follow food worth sharing. Manage your followers and requests.">
    <ViewNavigation label="People lists" items={[
      { href: "/people?list=following", label: "Following", active: list === "following" },
      { href: "/people?list=followers", label: "Followers", active: list === "followers" },
      { href: "/people?list=requests", label: `Requests${requestCount > 0 ? ` (${requestCount})` : ""}`, active: requestsView },
    ]} />
    {requestsView && <div className="mt-4"><ViewNavigation label="Request direction" items={[
      { href: "/people?list=requests", label: "Received", active: list === "requests" },
      { href: "/people?list=sent", label: "Sent", active: list === "sent" },
    ]} /></div>}
    <h2 className="mt-6 font-display text-xl font-bold">{lists[list]}</h2>
    {people.length ? <PeopleList client={client} people={people} mode={list} /> : <p className="mt-4 text-sm text-muted-foreground">{list === "requests" ? "No pending follow requests." : list === "followers" ? "No followers yet." : list === "sent" ? "No pending requests sent." : "You aren’t following anyone yet."}</p>}
    <Link href="/search?type=people" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link underline">Find people</Link>
    <nav aria-label="People pages" className="mt-4 flex gap-6">
      {offset > 0 && <Link href={`/people?list=${list}&offset=${Math.max(0, offset - 30)}`} className="inline-flex min-h-11 items-center text-link underline">Previous</Link>}
      {people.length === 30 && offset < 10000 && <Link href={`/people?list=${list}&offset=${offset + 30}`} className="inline-flex min-h-11 items-center text-link underline">More people</Link>}
    </nav>
  </PageLayout>;
}
