"use client";
import Link from "next/link";
import { PersonName } from "@/components/person-name";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { DateTimeLabel } from "@/components/date-time-label";
export type MentionNotification = { id: string; sender_name: string; sender_username: string | null; table_name: string; url: string; read_at: string | null; created_at: string };
function notificationDestination(url: string) {
  const message = url.match(/^\/tables\/([0-9a-f-]{36})\/messages\/([0-9a-f-]{36})$/);
  return message ? `/tables/${message[1]}?entry=${message[2]}#entry-${message[2]}` : url;
}
export function NotificationList({ notifications }: { notifications: MentionNotification[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return <>{error && <p role="alert" className="mt-4">{error}</p>}<ul className="mt-6 space-y-3">{notifications.map(item => <li key={item.id} className="rounded-xl border border-border bg-card p-5">
    <Link href={notificationDestination(item.url)} className="font-semibold text-link underline" onClick={() => {
      void createClient().rpc("read_mention_notification", { p_id: item.id }).then(({ error }) => {
        if (error) setError("Couldn’t mark this notification as read."); else router.refresh();
      });
    }}><PersonName name={item.sender_name} username={item.sender_username} /><span className="mt-1 block font-normal">mentioned you in {item.table_name}</span></Link>
    <p className="mt-2 text-xs text-muted-foreground">{item.read_at ? "Read" : "Unread"} · <DateTimeLabel at={item.created_at} /></p>
  </li>)}</ul>{notifications.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No notifications yet. Mentions from your Tables will appear here.</p>}</>;
}
