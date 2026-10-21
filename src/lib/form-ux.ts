export function normaliseLinks(text: string): { links: string[]; error: string } {
  const links: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const value = line.trim();
    if (!value) continue;
    if (links.length === 10) return { links: [], error: "Use at most 10 links, one per line." };
    // Only ordinary domain names receive a default scheme. Explicit schemes
    // still pass through the HTTP(S) check below.
    const candidate = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(value)
      ? `https://${value}` : value;
    try {
      const url = new URL(candidate);
      if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password || /[\s\\\u0000-\u001f\u007f]/.test(candidate) || !/^https?:\/\//i.test(candidate)) throw new Error();
      if (!url.hostname.startsWith("[")) {
        const host = url.hostname.replace(/\.$/, "");
        if (host.length > 254 || host.split(".").some(label => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) throw new Error();
      }
      const normalised = url.href;
      if (normalised.length > 2048) return { links: [], error: `Link on line ${index + 1} is too long (maximum 2,048 characters).` };
      links.push(normalised);
    } catch {
      return { links: [], error: `Check the link on line ${index + 1}. Use a website address such as food.com/recipe or https://food.com/recipe.` };
    }
  }
  return { links, error: "" };
}

export function photoSelectionProblem(files: Array<{ name: string; size: number; type: string }>, limit: number) {
  if (files.length > limit) return `Choose at most ${limit} photos.`;
  for (const file of files) {
    if (!file.size || file.size > 10_000_000) return "Each photo must be between 1 byte and 10 MB.";
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) &&
      !(file.type === "" && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) return "Choose JPEG, PNG, WebP or HEIC photos.";
  }
  return "";
}

export function formError(cause: unknown) {
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  if (code === "40001") return "This changed elsewhere. Your draft is still here. Reload and review the latest version before trying again.";
  if (code === "42501") return "This action is no longer available to your account. Your draft is still here.";
  return cause instanceof Error ? cause.message : "Couldn’t save this change. Your draft is still here, so try again.";
}
