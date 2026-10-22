import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createReadClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { AccountErasure } from "./account-erasure";
import { localErasureEnabled } from "../../../scripts/local-erasure-workflow.mjs";
import { appAccessStatus } from "@/lib/supabase/app-access";
import { UsernameForm } from "@/components/username-form";
import { PageLayout } from "@/components/page-layout";
import { PictureSettings } from "@/components/picture-settings";
import { pictures, picturesReady } from "@/lib/supabase/pictures";
import { socialReady } from "@/lib/supabase/social";
import { PrivacySettings } from "@/components/follow-controls";
import { introductionStatus } from "@/lib/supabase/introduction";
import { DisplayNameSettings } from "@/components/display-name-settings";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isSupabaseConfigured()) {
    return (
      <PageLayout title="Your account">
        <p className="mt-6 text-muted-foreground">Local sign-in is not configured yet. Add the local Supabase URL and public key to .env.local first.</p>
      </PageLayout>
    );
  }
  const supabase = await createReadClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/signin");
  const access = await appAccessStatus(supabase);
  const introduction = await introductionStatus(supabase);
  const username = await supabase.rpc("my_username");
  const social = await socialReady(supabase);
  const privacy = social ? await supabase.rpc("my_privacy") : { data: [], error: null };
  if (privacy.error) throw privacy.error;
  const pictureReady = await picturesReady(supabase);
  const profile = await supabase.from("my_profile").select("id,display_name").maybeSingle();
  if (profile?.error) throw profile.error;
  const ownPicture = profile?.data ? (await pictures(supabase, "profile", [profile.data.id])).get(profile.data.id) : null;
  // Optional local test restriction; do not expose erasure to other accounts
  // while checking the screen with a specifically approved disposable identity.
  const testAuthId = process.env.ACCOUNT_ERASURE_TEST_AUTH_ID;
  const erasureEnabled = localErasureEnabled(process.env,user.id)
    && (!testAuthId || user.id === testAuthId);
  const { data: impact, error: impactError } = erasureEnabled
    ? await supabase.rpc("account_erasure_impact")
    : { data: null, error: null };

  return (
    <PageLayout title="Your account" description="Your profile and account settings.">
      <section className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-2 break-all font-semibold">{user.email}</p>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Share food you love and join conversations around your Tables.
        </p>
        <SignOutButton />
        {access.canManage && <Link href="/account/access" className="mt-5 block text-sm font-semibold text-link underline">Manage app access</Link>}
      </section>
      {!username.error && <UsernameForm username={username.data} />}
      {profile.data && <DisplayNameSettings displayName={profile.data.display_name ?? ""} />}
      {introduction.ready && <section className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="font-display text-xl font-bold">A quick tour of Dinnerfolk</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Find your way around Feed, Plates, Tables, Menu and People.</p>
        <Link href="/introduction" className="mt-3 inline-flex min-h-11 items-center font-semibold text-link underline">Replay introduction</Link>
      </section>}
      {social && <Link href="/people" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-link underline">Your people · Following, followers and requests</Link>}
      {privacy.data?.[0] && <PrivacySettings isPrivate={privacy.data[0].is_private} version={privacy.data[0].version} bio={privacy.data[0].bio} />}
      {pictureReady && profile?.data && <PictureSettings kind="profile" targetId={profile.data.id} name={profile.data.display_name ?? "You"}
        picture={ownPicture ?? { assetId: null, url: null, version: 0 }} />}
      {erasureEnabled && impactError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Account erasure details are unavailable right now. Please try again later.
        </p>
      )}
      {erasureEnabled && impact && <AccountErasure impact={impact} />}
    </PageLayout>
  );
}
