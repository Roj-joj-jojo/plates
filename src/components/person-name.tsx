export function PersonName({ name, username }: { name: string; username?: string | null }) {
  return <span className="inline-flex min-w-0 flex-col align-top">
    <span className="break-words font-semibold">{name}</span>
    {username && <span className="break-all text-sm font-normal text-muted-foreground">@{username}</span>}
  </span>;
}
