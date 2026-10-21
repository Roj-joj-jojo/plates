import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/page-layout";
import { Introduction } from "@/components/introduction";
import { signedInClient } from "@/lib/supabase/connected";
import { introductionStatus } from "@/lib/supabase/introduction";

export const metadata: Metadata = { title: "Welcome to Plates" };
export const dynamic = "force-dynamic";

export default async function IntroductionPage() {
  const client = await signedInClient();
  const status = await introductionStatus(client);
  return <PageLayout title="Welcome to Plates" description="Food is worth sharing with people you know.">
    {status.ready ? <Introduction /> : <p className="text-muted-foreground">The introduction is unavailable right now. <Link href="/feed" className="text-link underline">Go to your Feed</Link></p>}
  </PageLayout>;
}
