import { notFound } from "next/navigation";
import { BackLink } from "@/components/plate-content";
import { TableMembers } from "@/components/table-members";
import { PageLayout } from "@/components/page-layout";
import { PictureSettings } from "@/components/picture-settings";
import { pictures, picturesReady } from "@/lib/supabase/pictures";
import { signedInClient } from "@/lib/supabase/connected";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Manage Table" };
export const dynamic = "force-dynamic";
export default async function MembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const client = await signedInClient();
  const { data: group } = await client.from("groups").select("id,name").eq("id", groupId).eq("availability", "available").maybeSingle();
  if (!group) notFound();
  const { data, error } = await client.rpc("table_members", { p_group_id: groupId });
  const pictureReady = !error && await picturesReady(client);
  const admin = (data ?? []).some((person: { is_me: boolean; role: string }) => person.is_me && person.role === "owner");
  const picture = pictureReady ? (await pictures(client, "table", [groupId])).get(groupId) : null;
  const memberPictures = pictureReady ? await pictures(client, "profile", (data ?? []).map((person: { profile_id: string }) => person.profile_id)) : new Map();
  const pictureUrls = Object.fromEntries([...memberPictures].map(([id, pic]) => [id, pic.url]));
  return <PageLayout title="Manage Table" backLink={<BackLink href={`/tables/${groupId}`}>{group.name}</BackLink>}>
    {error ? <p role="alert" className="text-destructive">Couldn’t load members. Please try again.</p> : <TableMembers groupId={groupId} tableName={group.name} members={data ?? []} pictureUrls={pictureUrls} />}
    {pictureReady && admin && <PictureSettings kind="table" targetId={groupId} name={group.name}
      picture={picture ?? { assetId: null, url: null, version: 0 }} />}
  </PageLayout>;
}
