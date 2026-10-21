"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton({ menuItem = false }: { menuItem?: boolean } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);

  async function signOut() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await createClient().auth.signOut();
      if (authError) throw authError;
      router.replace("/signin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t sign out. Try again.");
      setBusy(false);
      guard.current = false;
    }
  }

  if (menuItem) return <>
    <DropdownMenuItem disabled={busy} onSelect={event => { event.preventDefault(); void signOut(); }}>
      {busy ? "Signing out…" : "Sign out"}
    </DropdownMenuItem>
    {error && <p role="alert" className="max-w-64 px-3 py-2 text-sm text-destructive">{error}</p>}
  </>;
  return (
    <div className="mt-6">
      <button type="button" onClick={signOut} disabled={busy}
        className="min-h-11 rounded-md bg-primary hover:bg-primary-hover px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
