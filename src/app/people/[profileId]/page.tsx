import { notFound } from "next/navigation";
import { signedInClient } from "@/lib/supabase/connected";
import { PageLayout } from "@/components/page-layout";
import { PictureAvatar } from "@/components/picture-avatar";
import { pictures } from "@/lib/supabase/pictures";
import Link from "next/link";
import { socialReady, type SocialPerson } from "@/lib/supabase/social";
import { FollowButton } from "@/components/follow-controls";
import { PlateContent } from "@/components/plate-content";
import { PlateImages } from "@/components/plate-images";
import { plateImages } from "@/lib/supabase/plate-images";
import type { Metadata } from "next";
import { plateDestination } from "@/lib/navigation-ux";
import { PlateDate } from "@/components/plate-meta";
export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";
export default async function PersonPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) notFound();
  const client = await signedInClient();
  const ready = await socialReady(client);
  const { data, error } = ready ? await client.rpc("social_person", { p_profile_id: profileId })
    : await client.rpc("resolve_mentions", { p_ids: [profileId] });
  const person = data?.[0] as SocialPerson | undefined;
  if (error || !person) notFound();
  const picture = (await pictures(client, "profile", [profileId])).get(profileId);
  const blocked = ready && person.is_private && !person.is_me && person.follow_state !== "approved";
  const bio = ready ? await client.rpc("profile_bio", { p_profile_id: profileId }) : { data: null, error: null };
  if (bio.error) throw bio.error;
  const posts = ready && !blocked ? await client.from("plates").select("id,body,links,created_at")
    .eq("author_id", profileId).eq("availability", "available").order("created_at", { ascending: false }).limit(30) : { data: [], error: null };
  if (posts.error) throw posts.error;
  const photos = await Promise.all((posts.data ?? []).map(plate => plateImages(client, plate.id)));
  return <PageLayout title={person.display_name} description={"@" + person.username}>
    <PictureAvatar name={person.display_name} url={picture?.url} className="mb-4 size-20" />
    {ready ? <>
      {bio.data && <p className="mb-4 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{bio.data}</p>}
      <p className="mb-4 text-sm text-muted-foreground">{person.is_private ? "Private account" : "Open account"}</p>
      {!person.is_me && <FollowButton profileId={profileId} state={person.follow_state} version={person.follow_version} isPrivate={person.is_private} />}
      {blocked ? <p className="mt-6 text-sm text-muted-foreground">Only approved followers can see these Plates. Request to follow to see what they’re sharing.</p> : <section className="mt-6"><h2 className="font-display text-xl font-bold">Plates</h2>
        {posts.data?.length ? <ul className="mt-4 space-y-4">{posts.data.map((plate, index) => <li key={plate.id} id={`plate-${plate.id}`} className="scroll-mt-6 rounded-lg border bg-card p-5">
          <PlateContent body={plate.body} links={plate.links} /><PlateImages images={photos[index]} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4"><Link href={plateDestination(plate.id, `/people/${profileId}#plate-${plate.id}`)} className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground underline hover:text-link">View plate</Link><PlateDate at={plate.created_at} /></div>
        </li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No Plates shared yet.</p>}
        {posts.data?.length === 30 && <p className="mt-3 text-sm text-muted-foreground">Showing their 30 most recent Plates.</p>}
      </section>}
    </> : <p className="text-sm text-muted-foreground">Find their contributions in your shared Tables.</p>}
  </PageLayout>;
}
