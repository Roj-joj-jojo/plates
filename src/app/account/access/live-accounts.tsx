"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteManagedAccount, previewAccountDeletion, retryManagedCleanup, type DeletionScope } from "./account-actions";

export type LiveAccount = {
  profile_id: string; email: string | null; display_name: string | null;
  last_active_at: string | null; last_sign_in_at: string | null;
  state: string; is_owner: boolean; cleanup_state: string | null;
};
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value)) : "Not recorded yet";
}

export function LiveAccounts({ accounts, ready, deletionEnabled }: { accounts: LiveAccount[]; ready: boolean; deletionEnabled: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [review, setReview] = useState<{ scope: DeletionScope; fingerprint: string } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const pending = accounts.some(account => account.state !== "active");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [pending, router]);
  return <section className="mt-12 border-t border-border pt-8">
    <h2 className="font-display text-xl font-bold">Live accounts</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Alpha account management. Last active records recent use while the app is visible, at most once a minute. Times are London time.</p>
    {!ready && <p className="mt-4" role="status">Account management is waiting for local setup.</p>}
    {ready && !deletionEnabled && <p className="mt-4 text-sm">Deletion is waiting for verification and activation.</p>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    {ready && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b border-border">{["Email", "User name", "Last active", "Manage"].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{accounts.map(account => <tr key={account.profile_id} className="border-b border-border">
        <td className="px-3 py-4">{account.email ?? "Account cleanup in progress"}</td>
        <td className="px-3 py-4">{account.display_name || "Name erased"}</td>
        <td className="px-3 py-4 whitespace-nowrap">{date(account.last_active_at)}<span className="mt-1 block text-xs text-muted-foreground">Last sign-in: {date(account.last_sign_in_at)}</span></td>
        <td className="px-3 py-4">{account.is_owner ? <span>Owner account</span> : account.state !== "active" ? <>
          <span className="block text-xs">Deleting · {account.cleanup_state === "auth_pending" ? "finishing account cleanup" : "photo cleanup"}</span>
          <button disabled={busy || !deletionEnabled} className="mt-2 min-h-11 text-link underline disabled:opacity-40" onClick={() => startTransition(async () => {
            const result = await retryManagedCleanup(account.profile_id); setMessage(result.message); router.refresh();
          })}>Retry cleanup</button>
        </> : <button disabled={busy || !deletionEnabled} className="min-h-11 text-destructive underline disabled:opacity-40" onClick={() => startTransition(async () => {
          setMessage(""); const result = await previewAccountDeletion(account.profile_id);
          if (result.scope && result.fingerprint) { setReview({ scope: result.scope, fingerprint: result.fingerprint }); setConfirmation(""); }
          else setMessage(result.message ?? "Preview unavailable.");
        })}>Delete account</button>}</td>
      </tr>)}</tbody>
    </table>{accounts.length === 0 && <p className="py-4">No live accounts.</p>}</div>}
    {review && <div role="dialog" aria-modal="false" aria-labelledby="deletion-heading" className="mt-6 rounded-lg border border-destructive bg-card p-5">
      <h3 id="deletion-heading" className="font-display text-lg font-bold">Delete {review.scope.email}?</h3>
      <p className="mt-3 text-sm leading-6">This permanently removes their sign-in and photos, blanks their contributions and saved copies, and archives Tables where they are the sole owner. Other people’s contributions are preserved. A separate deletion record is saved before cleanup starts. This can’t be undone.</p>
      <p className="mt-3 text-sm">{String(review.scope.impact.authored_plates)} Plates · {String(review.scope.impact.authored_table_entries)} Table entries · {String(review.scope.impact.authored_replies)} replies · {String(review.scope.impact.copied_plate_saves)} saved Plate copies</p>
      {Array.isArray(review.scope.impact.sole_owner_table_details) && review.scope.impact.sole_owner_table_details.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{review.scope.impact.sole_owner_table_details.map(table => <li key={table.id}>Archive {table.name} ({table.other_active_members} other members)</li>)}</ul>}
      <p className="mt-3 text-sm">All content belonging to this account at confirmation will be included.</p>
      <label className="mt-4 block text-sm">Type <strong>DELETE {review.scope.email}</strong> to confirm<input autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 block w-full min-h-11 rounded-md border border-input bg-card p-3" /></label>
      <div className="mt-4 flex gap-5"><button disabled={busy || confirmation !== `DELETE ${review.scope.email}`} className="min-h-11 rounded-md bg-destructive px-4 py-2 text-destructive-foreground disabled:opacity-40" onClick={() => startTransition(async () => {
        const result = await deleteManagedAccount(review.scope.profile_id, confirmation, review.fingerprint);
        setMessage(result.message); setReview(null); setConfirmation(""); router.refresh();
      })}>{busy ? "Working…" : "Permanently delete account"}</button><button disabled={busy} onClick={() => setReview(null)}>Cancel</button></div>
    </div>}
  </section>;
}
