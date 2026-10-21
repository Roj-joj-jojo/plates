import type { Metadata } from "next";
import { CreateTableWithMembers } from "@/components/table-members";
import { PageLayout } from "@/components/page-layout";
import { BackLink } from "@/components/plate-content";
import { signedInClient } from "@/lib/supabase/connected";

export const metadata: Metadata = { title: "Create a Table" };
export const dynamic = "force-dynamic";

export default async function NewTablePage() {
  const client = await signedInClient();
  const { data: profile, error } = await client.from("my_profile").select("id").single();
  if (error || !profile) throw new Error("Your profile is unavailable. Please sign in again.");
  return <PageLayout title="Create a Table" description="Bring people together for food and conversation." backLink={<BackLink href="/tables">Your Tables</BackLink>}>
    <CreateTableWithMembers currentProfileId={profile.id} />
  </PageLayout>;
}
