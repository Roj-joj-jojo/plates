"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type RemoveKind = "message-own" | "message-admin" | "reply-own" | "reply-admin" | "plate-unpublish" | "share-remove" | "request-remove";

const COPY: Record<RemoveKind, { title: (who?: string) => string; body: string; action: string; pending: string }> = {
  "reply-own": {
    title: () => "Remove this reply?",
    body: "It will be replaced by “This reply was removed.” This can’t be undone.",
    action: "Remove reply",
    pending: "Removing…",
  },
  "reply-admin": {
    title: (who) => `Remove ${who}’s reply?`,
    body: "You’re removing it as a Table Admin. You can’t edit what they wrote.",
    action: "Remove reply",
    pending: "Removing…",
  },
  "message-own": {
    title: () => "Remove this message?",
    body: "It will be replaced by “This message was removed.” This can’t be undone.",
    action: "Remove message",
    pending: "Removing…",
  },
  "message-admin": {
    title: (who) => `Remove ${who}’s message?`,
    body: "You’re removing it as a Table Admin. You can’t edit what they wrote.",
    action: "Remove message",
    pending: "Removing…",
  },
  "plate-unpublish": {
    title: () => "Unpublish this Plate?",
    body: "The original is removed. Copies saved to Menus and existing replies stay. Table shares show “Plate unpublished”.",
    action: "Unpublish Plate",
    pending: "Unpublishing…",
  },
  "share-remove": {
    title: () => "Remove from this Table?",
    body: "Only the share is removed. The original Plate stays published. Replies stay readable; new replies stop.",
    action: "Remove share",
    pending: "Removing…",
  },
  "request-remove": {
    title: () => "Remove this question?",
    body: "Existing replies stay readable. New replies stop.",
    action: "Remove question",
    pending: "Removing…",
  },
};

type Props = {
  kind: RemoveKind | null; // null = closed
  who?: string;
  pending: boolean;
  /** Set when the last attempt failed. The dialog stays open, shows this, and the button becomes “Try again”. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmRemove({ kind, who, pending, error, onConfirm, onCancel }: Props) {
  const c = kind ? COPY[kind] : null;
  return (
    <AlertDialog open={!!kind} onOpenChange={(open) => !open && !pending && onCancel()}>
      {c && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.title(who)}</AlertDialogTitle>
            <AlertDialogDescription>{c.body}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm font-semibold text-destructive" role="alert">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction, so the dialog stays open while pending and shows errors */}
            <Button variant="destructive" disabled={pending} onClick={onConfirm}>
              {pending ? c.pending : error ? "Try again" : c.action}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
