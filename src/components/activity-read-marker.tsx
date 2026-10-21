"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { activityVisible } from "@/lib/activity-visibility";

export function ActivityReadMarker({ groupId, periodId, ids }: { groupId: string; periodId: string | null; ids: string[] }) {
  const marker = useRef<HTMLSpanElement>(null);
  const retry = useRef<() => void>(() => {});
  const [error, setError] = useState(false);
  const key = ids.join(",");
  useEffect(() => {
    const target = marker.current?.parentElement;
    if (!target || !periodId || !key) return;
    let disposed = false, busy = false, done = false;
    let geometry = { intersecting: false, height: 0, visibleHeight: 0 };
    const visible = () => activityVisible({ visible: document.visibilityState === "visible", ...geometry });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const receipts = key.split(",");
    async function acknowledge() {
      if (disposed || busy || done || !visible()) return;
      busy = true;
      try {
        const client = createClient();
        for (let start = 0; start < receipts.length; start += 100) {
          if (disposed || !visible()) return;
          const { error } = await client.rpc("ack_table_activity", { p_group_id: groupId, p_period_id: periodId, p_ids: receipts.slice(start, start + 100) });
          if (error) throw error;
        }
        if (disposed) return;
        done = true; setError(false);
        window.dispatchEvent(new Event("plates:mentions-changed"));
      } catch { if (!disposed) setError(true); }
      finally { busy = false; }
    }
    function schedule() {
      if (timer) clearTimeout(timer);
      if (visible() && !done) timer = setTimeout(() => { void acknowledge(); }, 750);
    }
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      geometry = { intersecting: entry.isIntersecting, visibleHeight: entry.intersectionRect.height, height: entry.boundingClientRect.height };
      schedule();
    }, { threshold: [0, 0.1, 0.5, 1] });
    observer.observe(target);
    document.addEventListener("visibilitychange", schedule);
    retry.current = () => { setError(false); schedule(); };
    return () => { disposed = true; observer.disconnect(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); };
  }, [key, groupId, periodId]);
  return <><span ref={marker} className="sr-only" aria-hidden />{error && <p role="alert" className="mt-2 text-xs text-muted-foreground">This activity may still show as unread. <Button variant="link" onClick={() => retry.current()}>Try again</Button></p>}</>;
}
