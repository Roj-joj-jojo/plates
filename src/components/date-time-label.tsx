import { conversationStamp, shortDateTime } from "@/lib/conversation-ux";

export function DateTimeLabel({ at }: { at: string }) {
  const full = conversationStamp(at).full;
  return <time dateTime={at} title={full} aria-label={full}>{shortDateTime(at)}</time>;
}
