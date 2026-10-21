const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function plateHeading(body: string, category = "Plate") {
  const line = body.split(/\r?\n/).map(value => value.trim()).find(Boolean)
    ?.replace(/@\[[0-9a-f-]{36}\]/gi, "@member").replace(/\s+/g, " ");
  const letters = Array.from(line || category);
  return letters.length > 72 ? letters.slice(0, 71).join("") + "…" : letters.join("");
}

// Return destinations never grant access: each destination performs its usual
// authenticated reads. Restrict paths rather than accepting an arbitrary URL.
export function plateReturn(value: unknown) {
  const fallback = { href: "/feed", label: "Feed" };
  if (typeof value !== "string" || value.length > 2000 || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://plates.invalid");
    if (url.origin !== "https://plates.invalid") return fallback;
    const label = url.pathname === "/feed" ? "Feed" : url.pathname === "/search" ? "Search results"
      : url.pathname === "/menu" ? "Menu" : /^\/people\/[^/]+$/.test(url.pathname) && uuid.test(url.pathname.split("/")[2]) ? "Profile" : null;
    return label ? { href: url.pathname + url.search + url.hash, label } : fallback;
  } catch { return fallback; }
}

export function plateDestination(id: string, returnTo: string) {
  return `/feed/${id}?returnTo=${encodeURIComponent(plateReturn(returnTo).href)}`;
}

export function tableResultDestination(groupId: string, rootKind: string, entryId: string, replyId: string | null) {
  const root = `/tables/${groupId}`;
  if (rootKind === "message") return `${root}?entry=${entryId}#entry-${entryId}`;
  const path = `${root}/${rootKind === "request" ? "requests" : "discussion"}/${entryId}`;
  return replyId ? `${path}?reply=${replyId}#reply-${replyId}` : path;
}
