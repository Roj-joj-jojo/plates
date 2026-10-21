export type TextPart = { text: string; href?: string };

// Link only explicit web addresses, never arbitrary schemes, email fragments or credentials.
export function webAddressParts(value: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of value.matchAll(/(?:https?:\/\/|www\.)[^\s<>"\u0000-\u001f]+/gi)) {
    const start = match.index!;
    if (start && /[\w@:/]/.test(value[start - 1])) continue;
    let address = match[0].replace(/[.,!?;:'’]+$/, "");
    for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
      while (address.endsWith(close) && address.split(close).length > address.split(open).length) address = address.slice(0, -1);
    }
    try {
      const url = new URL(/^www\./i.test(address) ? `https://${address}` : address);
      if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password || address.length > 2048 || /[\\\u007f]/.test(address)) continue;
      if (start > cursor) parts.push({ text: value.slice(cursor, start) });
      parts.push({ text: address, href: url.href });
      cursor = start + address.length;
    } catch { /* Invalid addresses remain ordinary escaped text. */ }
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor) });
  return parts;
}

export function contributionProblem(kind: string, body: string, links: string[], hasPhotos: boolean): string {
  return (kind === "message" || kind === "reply") && !body.trim() && !links.length && !hasPhotos
    ? "Add text or a link before saving." : "";
}
