import type { ReactNode } from "react";
import { PlateAuthor } from "@/components/plate-meta";
import { conversationStamp } from "@/lib/conversation-ux";
import { ConversationDayText } from "@/components/conversation-day-text";

export type ConversationPerson = { profileId: string | null; name: string; username?: string | null; pictureUrl?: string | null };

export function ConversationMeta({ person, editedAt, avatar = true, actions }: {
  person: ConversationPerson; editedAt?: string | null; avatar?: boolean; actions?: ReactNode;
}) {
  return <header className="mb-4 flex min-h-12 min-w-0 items-start gap-3">
    <div className="min-w-0 flex-1"><PlateAuthor {...person} avatar={avatar} edited={Boolean(editedAt)} /></div>
    {actions}
  </header>;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

export function ConversationTimestamp({ at, editedAt, fullDate = false }: { at: string; editedAt?: string | null; fullDate?: boolean }) {
  const stamp = conversationStamp(at);
  const date = new Date(at);
  return <p title={editedAt ? `Edited ${conversationStamp(editedAt).full}` : undefined} className="mt-3 text-right text-xs font-normal text-muted-foreground">
    <time dateTime={at} title={stamp.full} aria-label={stamp.full}>{fullDate && Number.isFinite(date.getTime()) ? `${shortDate.format(date)} · ${stamp.time}` : stamp.time}</time>
  </p>;
}

export function ConversationDay({ at }: { at: string }) {
  const stamp = conversationStamp(at);
  return <div className="flex items-center gap-3 py-3 text-center text-xs font-semibold text-muted-foreground"><span aria-hidden className="h-px flex-1 bg-border" /><span title={stamp.day}><ConversationDayText at={at} /></span><span aria-hidden className="h-px flex-1 bg-border" /></div>;
}
