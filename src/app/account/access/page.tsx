import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/plate-content";
import { PageLayout } from "@/components/page-layout";
import { signedInClient } from "@/lib/supabase/connected";
import { appAccessStatus } from "@/lib/supabase/app-access";
import { Allowlist, type AllowlistEntry } from "./allowlist";
import { LiveAccounts, type LiveAccount } from "./live-accounts";

export const metadata: Metadata = { title: "Manage app access" };
export const dynamic = "force-dynamic";

export default async function AppAccessPage() {
  const client = await signedInClient();
  const status = await appAccessStatus(client);
  if (!status.canManage) notFound();
  const { data, error } = await client.rpc("list_signup_allowlist");
  if (error) throw new Error("Allowlist unavailable");
  const live = await client.rpc("admin_live_accounts");
  if (live.error && !["PGRST202", "42883"].includes(live.error.code)) throw new Error("Account management unavailable");
  return <PageLayout title="Manage app access" description="Add people to Dinnerfolk. They’ll need a separate invitation to join a private Table." backLink={<BackLink href="/account">Your account</BackLink>}>
    {!status.enabled && <p role="status" className="mt-4 text-sm">Signup restrictions haven’t been activated yet.</p>}
    <Allowlist entries={(data ?? []) as AllowlistEntry[]} />
    <LiveAccounts accounts={(live.data ?? []) as LiveAccount[]} ready={!live.error} deletionEnabled={process.env.APP_ADMIN_ACCOUNT_ERASURE_ENABLED === "true"} />
  </PageLayout>;
}
