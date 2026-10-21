import type { Metadata } from "next";
import { EmailCodeForm } from "./email-code-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createReadClient } from "@/lib/supabase/server";
import { appAccessStatus } from "@/lib/supabase/app-access";

export const metadata: Metadata = { title: "Sign in" };

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const restricted = isSupabaseConfigured()
    ? (await appAccessStatus(await createReadClient())).enabled : false;
  return (
    <>
      <EmailCodeForm restricted={restricted} />
    </>
  );
}
