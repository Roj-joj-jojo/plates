"use client";

import { startTransition, useState, type FormEvent } from "react";
import { allowEmail, withdrawEmail } from "./actions";

export type AllowlistEntry = { id: string; email: string; allowed: boolean; created_at: string };

export function Allowlist({ entries }: { entries: AllowlistEntry[] }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(operation: () => Promise<{ ok: boolean; message: string }>, clearEmail = false) {
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await operation();
      if (result.ok) { setMessage(result.message); if (clearEmail) setEmail(""); }
      else setError(result.message);
    } catch { setError("Couldn’t update the allowlist. Please try again."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) startTransition(() => run(() => allowEmail(email), true));
  }
  function withdraw(entry: AllowlistEntry) {
    if (busy || !window.confirm(`Withdraw signup permission for ${entry.email}? This doesn’t delete an existing account.`)) return;
    startTransition(() => run(() => withdrawEmail(entry.id)));
  }
  return <>
    <form onSubmit={submit} className="mt-8 max-w-lg rounded-lg border border-border bg-card p-6">
      <label className="block text-sm font-semibold">Email address
        <input type="email" required maxLength={254} autoComplete="off" value={email}
          onChange={event => setEmail(event.target.value)} disabled={busy}
          className="mt-2 w-full min-h-11 rounded-md border border-input bg-card p-3" />
      </label>
      <button type="submit" disabled={busy} className="mt-4 min-h-11 rounded-md bg-primary hover:bg-primary-hover px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Saving…" : "Allow this email"}
      </button>
      <p className="mt-3 text-sm text-muted-foreground">Share the Dinnerfolk address with them afterwards. Adding an email here doesn’t send a message.</p>
    </form>
    {message && <p role="status" className="mt-4 text-sm text-success">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    <section className="mt-8"><h2 className="font-display text-xl font-bold">Pending signup permissions</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">An address leaves this list once its account is created. Withdrawing permission affects new signup only. It doesn’t remove an existing person from Dinnerfolk or a Table.</p>
      {entries.length ? <ul className="mt-4 space-y-3">{entries.map(entry => <li key={entry.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
        <div className="min-w-0"><p className="break-all font-semibold">{entry.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">{entry.allowed ? "Can create an account" : "Permission withdrawn"}</p></div>
        {entry.allowed ? <button type="button" disabled={busy} onClick={() => withdraw(entry)}
          className="min-h-11 text-sm font-semibold text-destructive underline disabled:opacity-60">Withdraw</button>
          : <button type="button" disabled={busy} onClick={() => startTransition(() => run(() => allowEmail(entry.email)))}
            className="min-h-11 text-sm font-semibold text-link underline disabled:opacity-60">Allow again</button>}
      </li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No pending addresses. Add someone above when you’re ready.</p>}
    </section>
  </>;
}
