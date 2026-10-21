"use client";
import Link from "next/link";
import { PersonName } from "@/components/person-name";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FollowerControls } from "@/components/follow-controls";
import { createClient } from "@/lib/supabase/browser";
import type { FollowNotification } from "@/lib/supabase/follow-notifications";
import { DateTimeLabel } from "@/components/date-time-label";

export function FollowNotificationList({ notifications }: { notifications: FollowNotification[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function markRead(id: string) {
    if (busy) return;
    setBusy(id); setError("");
    try {
      const { error } = await createClient().rpc("read_follow_notification", { p_id: id });
      if (error) throw error;
      router.refresh(); window.dispatchEvent(new Event("plates:mentions-changed"));
    } catch { setError("Couldn’t mark this notification as read. Please try again."); }
    finally { setBusy(null); }
  }
  return <section className="mt-6" aria-label="Follow activity">
    <h2 className="font-display text-xl font-bold">Follow activity</h2>
    {error && <p role="alert" className="mt-3 text-destructive">{error}</p>}
    <ul className="mt-3 space-y-3">{notifications.map(item => <li key={item.id} className="space-y-3 rounded-lg border border-border bg-card p-5">
      <p><Link href={`/people/${item.sender_id}`} className="text-link underline"><PersonName name={item.sender_name} username={item.sender_username} /></Link><span className="mt-1 block">{item.kind === "follow_request" ? "wants to follow you." : item.kind === "follow_accepted" ? "accepted your follow request." : "started following you."}</span></p>
      {item.kind === "follow_request" ? <><p className="text-sm text-muted-foreground">Accept to let them see your private Plates.</p><FollowerControls id={item.edge_id} version={item.edge_version} pending /></> :
        <p className="text-sm">{item.read_at ? <span className="text-muted-foreground">Read</span> : <button type="button" disabled={busy !== null} onClick={() => void markRead(item.id)} className="min-h-11 font-semibold text-link underline disabled:opacity-60">{busy === item.id ? "Saving…" : "Mark as read"}</button>}</p>}
      <p className="text-xs text-muted-foreground"><DateTimeLabel at={item.created_at} /></p>
    </li>)}</ul>
    {notifications.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No follow activity yet.</p>}
  </section>;
}
