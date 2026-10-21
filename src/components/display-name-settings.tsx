"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { displayNameProblem } from "@/lib/account-ux";

export function DisplayNameSettings({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const guard = useRef(false);
  const pending = busy || refreshing;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (guard.current || pending || draft === null) return;
    const problem = displayNameProblem(draft);
    if (problem) { setError(problem); return; }
    guard.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await createClient().rpc("update_display_name", { p_display_name: draft.trim() });
      if (error) throw error;
      setDraft(null); setMessage("Display name saved. Your username is unchanged.");
      window.dispatchEvent(new Event("plates:profile-changed"));
      startRefresh(() => router.refresh());
    } catch { setError("Couldn’t save your display name. Your draft is still here; please try again."); }
    finally { guard.current = false; setBusy(false); }
  }
  return <section className="mt-6 rounded-lg border bg-card p-6">
    <h2 className="font-display text-xl font-bold">Your display name</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">The name shown beside your contributions. It can change; your @username stays the same.</p>
    {draft === null ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 break-words font-semibold">{displayName}</p>
      <Button variant="outline" disabled={pending} onClick={() => { setDraft(displayName); setMessage(""); setError(""); }}>Edit display name</Button>
    </div> : <form onSubmit={save} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">Display name<input autoFocus autoComplete="nickname" value={draft} maxLength={160} disabled={pending}
        aria-describedby="display-name-help" onChange={event => { setDraft(event.target.value); setError(""); }} className="mt-2 block min-h-11 w-full rounded-md border border-input bg-card p-3 font-normal" /></label>
      <p id="display-name-help" className="text-sm text-muted-foreground">{Array.from(draft.trim()).length}/80 characters{displayNameProblem(draft) ? ` · ${displayNameProblem(draft)}` : ""}</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={pending || Boolean(displayNameProblem(draft)) || draft.trim() === displayName}>{pending ? "Saving…" : "Save display name"}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => { setDraft(null); setError(""); }}>Cancel</Button></div>
    </form>}
    {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </section>;
}
