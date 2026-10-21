import { redirect } from "next/navigation";
import { createReadClient } from "@/lib/supabase/server";
import { UsernameForm } from "@/components/username-form";
import { PageLayout } from "@/components/page-layout";
export const dynamic = "force-dynamic";
export default async function ChooseUsernamePage() {
  const client = await createReadClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/signin");
  const { data, error } = await client.rpc("my_username");
  if (error) throw new Error("Username settings unavailable. Please try again.");
  if (data) redirect("/feed");
  return <PageLayout title="Choose your username" description="A name people can use to mention you."><UsernameForm username={null} /></PageLayout>;
}
