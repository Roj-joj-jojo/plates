"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function LiveUpdates() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!isSupabaseConfigured() || pathname === "/signin") return;
    const client = createClient();
    const groupId = pathname.match(/^\/tables\/([0-9a-f-]{36})(?:\/|$)/)?.[1];
    let disposed = false, pending = false, connecting = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof client.channel> | undefined;
    let profileId: string | undefined;
    let previous: string | undefined;
    function refresh() {
      if (disposed || document.visibilityState !== "visible" || refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (!disposed) { router.refresh(); window.dispatchEvent(new Event("plates:mentions-changed")); }
      }, 200);
    }
    async function poll() {
      if (disposed || pending || !profileId || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const [account, table] = await Promise.all([
          client.from("account_updates").select("revision").eq("profile_id", profileId).maybeSingle(),
          groupId ? client.from("conversation_updates").select("revision").eq("group_id", groupId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);
        if (disposed || account.error || table.error) return;
        const current = `${account.data?.revision ?? "absent"}/${table.data?.revision ?? "absent"}`;
        if (previous !== undefined && previous !== current) refresh();
        previous = current;
      } catch { /* Realtime and the next visible poll can recover a dropped request. */ }
      finally { pending = false; }
    }
    async function connect() {
      if (disposed || connecting || channel) return;
      connecting = true;
      try {
      const { data: { user }, error } = await client.auth.getUser();
      if (disposed || error || !user) return;
      const { data } = await client.from("my_profile").select("id").maybeSingle();
      if (disposed || !data) return;
      profileId = data.id;
      await poll();
      if (disposed) return;
      const { data: session } = await client.auth.getSession();
      if (disposed || !session.session) return;
      await client.realtime.setAuth(session.session.access_token);
      if (disposed) return;
      channel = client.channel(`plates-updates-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "account_updates", filter: `profile_id=eq.${profileId}` }, refresh);
      if (groupId) channel.on("postgres_changes", { event: "*", schema: "public", table: "conversation_updates", filter: `group_id=eq.${groupId}` }, refresh);
      channel.subscribe(status => { if (status === "SUBSCRIBED") { refresh(); void poll(); } });
      } finally { connecting = false; }
    }
    function visible() { if (document.visibilityState === "visible") { refresh(); void poll(); } }
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    const interval = setInterval(() => { void poll(); if (!channel) void connect().catch(() => {}); }, 10_000);
    void connect().catch(() => { /* A route change retries initialization. */ });
    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
      if (channel) void client.removeChannel(channel);
    };
  }, [pathname, router]);
  return null;
}
