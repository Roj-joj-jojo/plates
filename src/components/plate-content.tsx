import Link from "next/link";
import { createReadClient } from "@/lib/supabase/server";
import { webAddressParts } from "@/lib/content-ux";

export async function PlateContent({ body, links, linkify = false }: { body: string; links: unknown; linkify?: boolean }) {
  const urls = Array.isArray(links) ? links.filter((link): link is string => typeof link === "string") : [];
  const ids = [...new Set([...body.matchAll(/@\[([0-9a-f-]{36})\]/g)].map(match => match[1]))];
  const resolved = ids.length ? await (await createReadClient()).rpc("resolve_mentions", { p_ids: ids.slice(0, 100) }) : { data: [] };
  const names = new Map<string, string>((resolved.data ?? []).map((person: { profile_id: string; username: string }) => [person.profile_id, person.username]));
  const parts = body.split(/(@\[[0-9a-f-]{36}\])/g);
  return <>
    {body && <p className="whitespace-pre-wrap text-sm leading-5 [overflow-wrap:anywhere] sm:text-base sm:leading-6">{parts.map((part, index) => {
      const id = part.match(/^@\[([0-9a-f-]{36})\]$/)?.[1];
      if (!id) return linkify ? <span key={index}>{webAddressParts(part).map((piece, position) => piece.href
        ? <a key={position} href={piece.href} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline">{piece.text}</a>
        : piece.text)}</span> : part;
      const username = names.get(id);
      return username ? <Link key={index} href={`/people/${id}`} className="font-medium text-link underline">@{username}</Link> : <span key={index}>@FormerMember</span>;
    })}</p>}
    {urls.length > 0 && <ul className="mt-3 space-y-2 text-sm">
      {urls.map((url, index) => <li key={`${url}-${index}`} className="break-all">
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline">{url}</a>
      </li>)}
    </ul>}
  </>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-link underline">← {children}</Link>;
}
