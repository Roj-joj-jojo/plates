"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Bell } from "lucide-react";
import { followNotifications } from "@/lib/supabase/follow-notifications";
import { plateCommentNotifications } from "@/lib/supabase/plate-interactions";
export function MentionsBadge({ icon = false }: { icon?: boolean } = {}) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isSupabaseConfigured() || pathname === "/signin") return;
    let disposed = false;
    async function load() {
      const client = createClient();
      const [{ data, error }, follows, comments] = await Promise.all([
        client.rpc("my_mention_notifications"), followNotifications(client), plateCommentNotifications(client),
      ]);
      if (!disposed && !error) setCount((data ?? []).filter((item: { read_at: string | null }) => !item.read_at).length
        + follows.filter(item => item.kind === "follow_request" || !item.read_at).length
        + comments.filter(item => !item.read_at).length);
    }
    const changed = () => { void load().catch(() => {}); };
    changed(); window.addEventListener("plates:mentions-changed", changed);
    return () => { disposed = true; window.removeEventListener("plates:mentions-changed", changed); };
  }, [pathname]);
  return <>{icon ? <><Bell className="size-6" aria-hidden /><span className="sr-only">Notifications</span></> : "Notifications"}
    {count > 0 && pathname !== "/signin" && <span className={(icon ? "absolute right-0 top-0 " : "ml-1 ") + "rounded-sm bg-unread px-1.5 py-0.5 text-xs text-unread-foreground"}
      aria-label={`${count}${count >= 100 ? " or more" : ""} unread notifications`}>{count >= 100 ? "100+" : count}</span>}</>;
}
