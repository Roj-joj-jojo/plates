"use client";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { EditPlateForm, SharePlateForm } from "@/components/connected-actions";
import { UnpublishPlateControl } from "@/components/content-controls";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useActionNotice } from "@/components/form-feedback";
import { PLATE_UPDATED } from "@/lib/ui-copy";

export function PlateDetailCard({ plateId, revision, author, children, saveAction, canEdit, canUnpublish, editValues, groups }: {
  plateId: string; revision: number; author: ReactNode; children: ReactNode; saveAction: ReactNode;
  canEdit: boolean; canUnpublish: boolean; editValues: ComponentProps<typeof EditPlateForm>;
  groups: { id: string; name: string }[];
}) {
  // Snapshot at opening: a live update cannot overwrite the draft or its expected revision.
  const [editing, setEditing] = useState<typeof editValues | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const options = useRef<HTMLDivElement>(null);
  const announce = useActionNotice();
  function finishEditing() {
    setEditing(null);
    requestAnimationFrame(() => options.current?.querySelector<HTMLButtonElement>("button")?.focus());
  }
  return <article className="rounded-lg border border-border bg-card p-5 sm:p-6">
    <header className="flex min-h-11 items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{author}</div>
      {canEdit && <div ref={options} className="shrink-0"><UnpublishPlateControl plateId={plateId} revision={revision} canUnpublish={canUnpublish}
        disabled={Boolean(editing)} onEdit={() => setEditing({ ...editValues })} /></div>}
    </header>
    {editing ? <EditPlateForm {...editing} embedded onSaved={() => { finishEditing(); announce(PLATE_UPDATED); }} onCancel={finishEditing} /> : <>
      <div className="mt-4">{children}</div>
      <footer className="mt-5 flex flex-wrap items-start gap-3 border-t pt-4 [&>div]:mt-0">
        {saveAction}
        <Sheet open={sharing} onOpenChange={open => { if (!shareBusy) setSharing(open); }}>
          <SheetTrigger asChild><Button variant="outline"><Users aria-hidden="true" />Share to a Table</Button></SheetTrigger>
          <SheetContent><SheetTitle className="font-display text-xl font-bold">Share to a Table</SheetTitle>
            <SheetDescription className="mt-2 text-sm text-muted-foreground">Choose a Table and add a note if you like. The original Plate stays in Feed.</SheetDescription>
            {groups.length ? <SharePlateForm plateId={plateId} groups={groups} embedded onBusyChange={setShareBusy} /> : <div className="mt-6">
              <p className="text-sm text-muted-foreground">Create a Table to share this Plate with people you know.</p>
              <Button asChild className="mt-4"><Link href="/tables/new">Create a Table</Link></Button>
            </div>}
          </SheetContent>
        </Sheet>
      </footer>
    </>}
  </article>;
}
