"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/navigation";
export function AppFrame({children}:{children:React.ReactNode}) {
  const pathname = usePathname();
  if (pathname === "/signin") return <main id="main" tabIndex={-1} className="min-h-dvh bg-background px-4 py-10 sm:py-16"><div className="mx-auto max-w-lg">{children}</div></main>;
  const table = /^\/tables\/[0-9a-f-]{36}\/?$/.test(pathname);
  const pageLayout = /^\/(feed|search|tables|menu|notifications|activity|account|people|choose-username|introduction)(\/|$)/.test(pathname);
  if(table) return <main id="main" tabIndex={-1}>{children}</main>;
  return <div className="min-h-dvh bg-background">
    <aside className="fixed inset-y-0 left-0 hidden w-[200px] flex-col overflow-y-auto border-r px-4 py-6 thread:flex">
      <Link href="/feed" aria-label="Plates home" className="mb-8 px-3 font-display text-2xl font-bold">Plates<span className="text-primary">.</span></Link>
      <Navigation vertical />
      <p className="mt-auto px-3 pt-8 text-meta text-muted-foreground">Food is worth sharing.</p>
    </aside>
    <main id="main" tabIndex={-1} className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] thread:ml-[200px] thread:pb-0">
      {pageLayout ? children : <div className="mx-auto max-w-thread px-4 py-6 thread:px-6 thread:py-8">{children}</div>}
    </main>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background px-1 pb-[env(safe-area-inset-bottom)] thread:hidden"><Navigation compact /></div>
  </div>;
}
