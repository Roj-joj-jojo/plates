import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPerson } from "@/lib/supabase/social";
import { pictures } from "@/lib/supabase/pictures";
import { PictureAvatar } from "@/components/picture-avatar";
import { FollowButton, FollowerControls } from "@/components/follow-controls";

export async function PeopleList({ client, people, mode }: { client: SupabaseClient; people: SocialPerson[]; mode?: string }) {
  const avatars = await pictures(client, "profile", people.map(person => person.profile_id));
  return <ul className="mt-4 space-y-3">{people.map(person => <li key={person.profile_id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
    <Link href={"/people/" + person.profile_id} className="flex min-w-0 flex-1 items-center gap-3 rounded-sm">
      <PictureAvatar name={person.display_name} url={avatars.get(person.profile_id)?.url} />
      <div className="min-w-0"><p className="break-words font-semibold">{person.display_name}</p><p className="break-all text-sm text-muted-foreground">@{person.username}{person.is_private ? " · Private" : ""}{person.is_me ? " · You" : ""}</p></div>
    </Link>
    {!person.is_me && (mode === "requests" || mode === "followers") && person.edge_id
      ? <FollowerControls id={person.edge_id} version={person.edge_version ?? 0} pending={mode === "requests"} />
      : !person.is_me && <FollowButton profileId={person.profile_id} state={person.follow_state} version={person.follow_version} isPrivate={person.is_private} />}
  </li>)}</ul>;
}

export function PrivatePlateNotice({ authorId }: { authorId: string }) {
  return <div className="mt-2 space-y-2"><p className="text-sm text-muted-foreground">Private Plate. Follow its author and wait for approval to see it.</p>
    <Link href={"/people/" + authorId} className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline">View author · Request to follow</Link>
  </div>;
}
