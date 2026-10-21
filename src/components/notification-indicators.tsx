"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Mail } from "lucide-react";
import { useCurrentProfile } from "@/components/current-profile";
import { createClient } from "@/lib/supabase/browser";
import { myTableActivity } from "@/lib/supabase/table-activity";
import { followNotifications } from "@/lib/supabase/follow-notifications";
import { plateCommentNotifications } from "@/lib/supabase/plate-interactions";

export function NotificationIndicators() {
  const pathname = usePathname();
  const profile = useCurrentProfile();
  const owner = profile?.id;
  const [counts, setCounts] = useState({ owner: "", bell: 0, tables: 0, error: false });
  useEffect(() => {
    if (!owner || pathname === "/signin") return;
    const accountId = owner;
    let disposed = false, sequence = 0;
    async function load() {
      const token = ++sequence;
      const client = createClient();
      try {
        const [activity, follows, comments] = await Promise.all([myTableActivity(client), followNotifications(client), plateCommentNotifications(client)]);
        let legacy = 0;
        if (activity === null) {
          const { data, error } = await client.rpc("my_mention_notifications");
          if (error) throw error;
          legacy = (data ?? []).filter((item: { read_at: string | null }) => !item.read_at).length;
        }
        if (!disposed && token === sequence) setCounts({ owner: accountId,
          bell: legacy + follows.filter(item => item.kind === "follow_request" || !item.read_at).length + comments.filter(item => !item.read_at).length,
          tables: activity?.length ?? 0, error: false });
      } catch { if (!disposed && token === sequence) setCounts({ owner: accountId, bell: 0, tables: 0, error: true }); }
    }
    const changed = () => { void load(); };
    changed(); window.addEventListener("plates:mentions-changed", changed);
    return () => { disposed = true; window.removeEventListener("plates:mentions-changed", changed); };
  }, [pathname, owner]);
  const current = profile && counts.owner === profile.id ? counts : { bell: 0, tables: 0, error: false };
  return <>{[{ href: "/notifications", name: "Notifications", count: current.bell, Icon: Bell }, { href: "/activity", name: "Table activity", count: current.tables, Icon: Mail }].map(({ href, name, count, Icon }) =>
    <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} title={current.error ? `${name}: unread count unavailable` : name} className="relative grid size-11 shrink-0 place-items-center rounded-md text-primary-foreground hover:bg-card/10">
      <Icon className="size-5 sm:size-6" aria-hidden /><span className="sr-only">{name}</span>
      {(count > 0 || current.error) && <span className="absolute right-0 top-0 rounded-sm bg-unread px-1.5 py-0.5 text-xs text-unread-foreground" aria-label={current.error ? "Unread count unavailable" : `${count}${count >= 100 ? " or more" : ""} unread ${href === "/activity" ? "Tables" : "notifications"}`}>{current.error ? "?" : count >= 100 ? "100+" : count}</span>}
    </Link>)}</>;
}
