"use client";

import { startTransition, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { requestAccountErasure } from "./erasure-actions";

type Impact = {
  authored_plates?: number;
  authored_table_entries?: number;
  authored_replies?: number;
  copied_plate_saves?: number;
  own_plate_saves?: number;
  own_request_saves?: number;
  sole_owner_table_details?: { id: string; name: string; other_active_members: number }[];
};

export function AccountErasure({ impact }: { impact: Impact }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  async function startErasure() {
    if (confirmation !== "ERASE" || busy || started) return;
    setBusy(true);
    setError("");
    let accepted = false;
    try {
      const client = createClient();
      const result = await requestAccountErasure(confirmation);
      if (!result.accepted) throw new Error("Erasure was not confirmed");
      accepted = true;
      setStarted(true);
      const { error: signOutError } = await client.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
    } catch {
      setError(accepted
        ? "Your erasure request was accepted, but this browser couldn’t finish signing out. You can close this page."
        : "We couldn’t confirm your erasure request. Refresh this page to check your account before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-destructive/30 bg-card p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold">Erase your account</h2>
      {started ? (
        <p role="status" className="mt-4 text-sm leading-6">
          Your account access has been disabled. Your request is queued for photo and
          sign-in cleanup. You can close this page.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This will blank your Plates, Table messages, replies, saved copies and name,
            then remove private photos and your sign-in identity. Your entries may remain
            as blank conversation placeholders. Other members’ independent contributions remain.
          </p>
          <p className="mt-3 text-sm font-semibold text-destructive">
            You can’t undo this request.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This affects {impact.authored_plates ?? 0} Plates, {impact.authored_table_entries ?? 0}
            {" "}Table entries, {impact.authored_replies ?? 0} replies and
            {" "}{impact.copied_plate_saves ?? 0} saved copies of your Plates.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your Menu will also become unavailable, including {impact.own_plate_saves ?? 0}
            {" "}saved Plates and {impact.own_request_saves ?? 0} saved Requests.
          </p>
          {(impact.sole_owner_table_details?.length ?? 0) > 0 && (
            <div className="mt-4 text-sm leading-6">
              <p className="font-semibold">These Tables will be archived:</p>
              <p>You are their only active admin. All members will lose access to these Tables.</p>
              <ul className="mt-2 list-disc pl-5">
                {impact.sole_owner_table_details?.map((table) => (
                  <li key={table.id}>
                    {table.name} ({table.other_active_members} other active members)
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Tables with another active admin will stay available to their remaining members.
          </p>
          <label htmlFor="erasure-confirmation" className="mt-5 block text-sm font-semibold">
            Type ERASE to confirm
          </label>
          <input id="erasure-confirmation" value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy} autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-md border border-input bg-card p-3" />
          <button type="button" onClick={() => startTransition(startErasure)}
            disabled={busy || confirmation !== "ERASE"}
            className="mt-4 min-h-11 rounded-md bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60">
            {busy ? "Starting…" : "Start account erasure"}
          </button>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
