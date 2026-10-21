"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/browser";
import type { MenuItemKind, MenuItemState } from "@/lib/supabase/menu-removal";

export function MenuItemActions({ kind, saveId, removed, version, undo = false }: {
  kind: MenuItemKind; saveId: string; removed: boolean; version: number; undo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const pending = busy || refreshing;
  async function change() {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const { data, error } = await createClient().rpc("set_menu_item_removed", {
        p_kind: kind, p_save_id: saveId, p_removed: !removed, p_expected_version: version,
      });
      if (error) {
        setError(error.code === "40001" ? "This item changed elsewhere. Refresh before trying again." : "Couldn’t change this saved item. It may no longer be available.");
        return;
      }
      setConfirm(false);
      const params = new URLSearchParams(pathname === "/menu" ? search.toString() : "");
      for (const key of ["notice", "undoKind", "undoId", "undoVersion"]) params.delete(key);
      params.set("notice", removed ? "restored" : "removed");
      if (!removed) {
        params.set("undoKind", kind); params.set("undoId", saveId); params.set("undoVersion", String(data));
      }
      startTransition(() => { router.replace(`/menu?${params.toString()}`, { scroll: false }); router.refresh(); });
    } catch { setError("Couldn’t connect. Please try again."); }
    finally { guard.current = false; setBusy(false); }
  }
  return <div className="mt-4 space-y-2">
    <Button variant={removed ? "outline" : "ghost"} disabled={pending} onClick={() => removed ? void change() : setConfirm(true)}>
      {pending ? "Saving…" : undo ? "Undo" : removed ? "Restore to Menu" : "Remove from Menu"}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Link href="/menu?view=removed" className="underline">View removed items</Link></p>}
    <AlertDialog open={confirm} onOpenChange={open => { if (!pending) setConfirm(open); }}>
      <AlertDialogContent>
        <AlertDialogTitle>Remove this {kind === "plate" ? "Plate" : "Request"} from your Menu?</AlertDialogTitle>
        <AlertDialogDescription>You can undo this or restore it from Removed items. The original and other people’s saves stay unchanged.</AlertDialogDescription>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep in Menu</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => void change()}>{pending ? "Removing…" : "Remove from Menu"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

export function SavedMenuItem({ kind, sourceId, compact = false }: { kind: MenuItemKind; sourceId: string; compact?: boolean }) {
  const [item, setItem] = useState<MenuItemState | null>(null);
  useEffect(() => {
    let disposed = false;
    async function load() {
      const { data, error } = await createClient().rpc("saved_menu_item_state", { p_kind: kind, p_source_id: sourceId });
      if (!disposed && !error) setItem(data?.[0] ?? null);
    }
    const changed = () => { void load().catch(() => {}); };
    changed(); window.addEventListener("plates:mentions-changed", changed);
    return () => { disposed = true; window.removeEventListener("plates:mentions-changed", changed); };
  }, [kind, sourceId]);
  return <div className={compact ? "text-sm" : "mt-3 text-sm"}>
    {item?.removed_at ? <><p className="text-muted-foreground">This saved copy is in Removed items.</p>
      <MenuItemActions kind={kind} saveId={item.save_id} removed version={item.menu_version} /></> :
      <Link href="/menu" aria-label="Saved copy · View in Menu" title="View saved copy in Menu" className={compact ? "inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-link hover:bg-muted" : "inline-flex min-h-11 items-center font-semibold text-link underline"}>
        {compact ? <><Bookmark aria-hidden="true" className="size-4" fill="currentColor" />Saved</> : "Saved copy · View in Menu"}
      </Link>}
  </div>;
}
