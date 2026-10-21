import "server-only";
import { profileNames, profileUsernames, type signedInClient } from "./connected";
import { pictures } from "./pictures";
import type { ConversationPerson } from "@/components/conversation-meta";

export async function conversationPeople(client: Awaited<ReturnType<typeof signedInClient>>, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const [names, usernames, avatars] = await Promise.all([
    profileNames(client, unique), profileUsernames(client, unique), pictures(client, "profile", unique),
  ]);
  return new Map<string, ConversationPerson>(unique.map(id => [id, {
    profileId: id, name: names.get(id) ?? "Former member", username: usernames.get(id), pictureUrl: avatars.get(id)?.url,
  }]));
}
