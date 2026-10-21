import Link from "next/link";

export function ViewNavigation({ label, items }: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
}) {
  return <nav aria-label={label} className="flex flex-wrap items-center gap-1">
    {items.map(item => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-md px-3 py-2 text-center text-sm font-semibold [overflow-wrap:anywhere] ${item.active ? "bg-secondary text-secondary-foreground" : "text-link hover:bg-muted"}`}>
      {item.label}
    </Link>)}
  </nav>;
}
