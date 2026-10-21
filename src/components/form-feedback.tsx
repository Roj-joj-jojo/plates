"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

const ActionNotice = createContext<(message: string) => void>(() => {});
export const useActionNotice = () => useContext(ActionNotice);

export function ActionNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useTransientMessage<string>("");
  return <ActionNotice.Provider value={setNotice}>{children}
    {notice && <div role="status" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm shadow-lg sm:left-auto sm:right-4 sm:bottom-6 sm:mx-0 sm:max-w-sm"><p>{notice}</p><Button variant="ghost" className="pointer-events-auto" onClick={() => setNotice("")}>Dismiss</Button></div>}
  </ActionNotice.Provider>;
}

export function CharacterCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  return <p className="mt-1 text-xs font-normal text-muted-foreground">{value.length.toLocaleString("en-GB")} / {max.toLocaleString("en-GB")} characters{remaining <= 20 ? remaining === 0 ? " · Limit reached" : ` · ${remaining} remaining` : ""}</p>;
}

// Action feedback stays long enough to read, while errors remain actionable.
export function useTransientMessage<T extends string | boolean>(empty: T) {
  const [message, setMessage] = useState<T>(empty);
  useEffect(() => {
    if (message === empty) return;
    const timer = window.setTimeout(() => setMessage(empty), 8000);
    return () => window.clearTimeout(timer);
  }, [message, empty]);
  return [message, setMessage] as const;
}

export function useDraftExit(dirty: boolean, busy = false) {
  const router = useRouter();
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin || (next.pathname === window.location.pathname && next.search === window.location.search)) return;
      // Catch ordinary route links before Next handles them. Browser history,
      // programmatic redirects and external links use their native lifecycle.
      event.preventDefault(); event.stopImmediatePropagation();
      if (!busy) setDiscard(() => () => router.push(next.pathname + next.search + next.hash));
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", followLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", followLink, true); };
  }, [dirty, busy, router]);
  const requestExit = (action: () => void) => { if (busy) return; if (dirty) setDiscard(() => action); else action(); };
  const dialog = <AlertDialog open={Boolean(discard)} onOpenChange={open => { if (!open && !busy) setDiscard(null); }}>
    <AlertDialogContent><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
      <AlertDialogDescription>Your changes haven’t been saved. Keep editing to preserve this draft.</AlertDialogDescription>
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep editing</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={() => { const action = discard; setDiscard(null); action?.(); }}>Discard changes</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { requestExit, dialog };
}
