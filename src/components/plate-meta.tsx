import Link from "next/link";
import { PictureAvatar } from "@/components/picture-avatar";
import { conversationStamp } from "@/lib/conversation-ux";

export function PlateAuthor({ profileId, name, username, pictureUrl, category, edited = false, avatar = true }: {
  profileId: string | null; name: string; username?: string | null; pictureUrl?: string | null; category?: string; edited?: boolean; avatar?: boolean;
}) {
  return <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
    <div className="flex min-h-11 min-w-0 max-w-full items-center gap-3">
      {avatar && <PictureAvatar name={name} url={pictureUrl} className="size-10 sm:size-12 [&>span]:text-sm sm:[&>span]:text-base" />}
      {profileId ? <Link href={`/people/${profileId}`} className="inline-flex min-h-11 min-w-0 items-center break-words rounded-sm text-base font-semibold text-link hover:underline sm:text-lg">{name}</Link> : <span className="min-w-0 break-words text-base font-semibold sm:text-lg">{name}</span>}
    </div>
    <p className="ml-auto min-w-0 max-w-full text-right text-xs font-normal text-muted-foreground [overflow-wrap:anywhere] sm:text-sm">
      {username && <span>@{username}</span>}
      {category && <>{username && <span aria-hidden="true"> · </span>}{category}</>}
      {edited && <>{(username || category) && " · "}Edited</>}
    </p>
  </div>;
}

const dateLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

export function PlateDate({ at }: { at: string }) {
  const date = new Date(at);
  const full = conversationStamp(at).full;
  return <p className="mt-4 text-right text-xs text-muted-foreground"><time dateTime={at} title={full} aria-label={full}>
    {Number.isFinite(date.getTime()) ? dateLabel.format(date) : "Date unavailable"}
  </time></p>;
}
