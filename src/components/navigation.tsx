"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/feed", label: "Feed" },
  { href: "/tables", label: "Tables" },
  { href: "/menu", label: "Menu" },
  { href: "/search", label: "Search" },
  { href: "/people", label: "People" },
];

export function Navigation({ vertical = false, compact = false }: { vertical?: boolean; compact?: boolean } = {}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className={`flex gap-1 bg-background ${vertical ? "flex-col" : compact ? "w-full justify-between" : "flex-wrap"}`}>
      {items.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 rounded-md py-3 font-semibold ${compact ? "min-w-0 flex-1 px-0.5 text-meta text-center" : "px-3 text-sm sm:px-4"} ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
