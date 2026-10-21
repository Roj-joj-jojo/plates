"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
export function UsernameForm({ username }: { username: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!window.confirm(`Choose @${value} permanently? You won’t be able to change this username.`)) return;
    setBusy(true); setError("");
    try {
      const { error } = await createClient().rpc("choose_username", { p_username: value });
      if (error) { setError(error.code === "23505" ? "That username is already taken. Try another." : "Couldn’t choose this username. Check the rules and try again."); return; }
      window.dispatchEvent(new Event("plates:profile-changed"));
      router.replace("/feed"); router.refresh();
    } catch { setError("Couldn’t save your username. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-lg border border-border bg-card p-6">
    <h2 className="font-display text-xl font-bold">Your username</h2>
    {username ? <p className="mt-3 font-semibold">@{username}</p> : <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-sm leading-6">Choose once for mentions. Use 3–30 letters, numbers or underscores, starting with a letter. Capitalisation is preserved, but doesn’t make a username unique. You can’t change it later.</p>
      <label className="block text-sm">Username<input autoComplete="username" required pattern="[A-Za-z][A-Za-z0-9_]{2,29}" minLength={3} maxLength={30} value={value} onChange={event => setValue(event.target.value)} className="mt-2 block w-full min-h-11 rounded-md border border-input bg-card p-3" /></label>
      <button disabled={busy} className="min-h-11 rounded-md bg-primary hover:bg-primary-hover px-4 py-3 text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Choose username"}</button>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </form>}
  </section>;
}
