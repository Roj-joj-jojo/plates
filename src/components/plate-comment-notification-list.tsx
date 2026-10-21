"use client";
import Link from "next/link";
import { PersonName } from "@/components/person-name";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { PlateCommentNotification } from "@/lib/supabase/plate-interactions";
import { DateTimeLabel } from "@/components/date-time-label";

export function PlateCommentNotificationList({ notifications }: { notifications: PlateCommentNotification[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function markRead(id: string) {
    if (busy) return;
    setBusy(id); setError("");
    try {
      const { error } = await createClient().rpc("read_plate_comment_notification", { p_id: id });
      if (error) throw error;
      router.refresh(); window.dispatchEvent(new Event("plates:mentions-changed"));
    } catch { setError("Couldn’t mark this notification as read. Please try again."); }
    finally { setBusy(null); }
  }
  return <section className="mt-8" aria-label="Plate comment activity"><h2 className="font-display text-xl font-bold">Plate comments</h2>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <ul className="mt-3 space-y-3">{notifications.map(item => <li key={item.id} className="rounded-lg border border-border bg-card p-5">
      <Link href={`/feed/${item.plate_id}?comment=${item.comment_id}#comment-${item.comment_id}`} onClick={() => { void markRead(item.id); }} className="font-semibold text-link underline">
        <PersonName name={item.sender_name} username={item.sender_username} /><span className="mt-1 block font-normal">commented on your Plate</span>
      </Link>
      <p className="mt-2 text-xs text-muted-foreground"><DateTimeLabel at={item.created_at} /></p>
      {item.read_at ? <p className="mt-2 text-sm text-muted-foreground">Read</p> : <button type="button" disabled={busy !== null} onClick={() => void markRead(item.id)} className="mt-2 min-h-11 text-sm font-semibold text-link underline disabled:opacity-60">{busy === item.id ? "Saving…" : "Mark as read"}</button>}
    </li>)}</ul>
    {notifications.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No new Plate comments.</p>}
  </section>;
}
