"use client";

import { useSyncExternalStore } from "react";
import { conversationDate, conversationStamp } from "@/lib/conversation-ux";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const notify = () => { for (const listener of listeners) listener(); };
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(notify, 30_000);
    document.addEventListener("visibilitychange", notify);
    window.addEventListener("focus", notify);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", notify);
      window.removeEventListener("focus", notify);
    }
  };
}
const currentDay = () => conversationStamp(new Date().toISOString()).dayKey;
const serverDay = () => null;

export function ConversationDayText({ at }: { at: string }) {
  // The first client render matches SSR; Today is applied after hydration and refreshed at midnight/resume.
  const today = useSyncExternalStore(subscribe, currentDay, serverDay);
  return conversationDate(at, today);
}
