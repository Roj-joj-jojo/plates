import Link from "next/link";

export default function NotFound() {
  return <section className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center text-foreground">
    <p className="text-label text-muted-foreground">Page unavailable</p>
    <h1 className="mt-3 font-display text-2xl font-bold">We can’t open this page</h1>
    <p className="mt-3 max-w-md text-sm text-muted-foreground">The link may be out of date, or this page may not be available to your account.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-4">
      <Link href="/feed" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary-hover">Go to Feed</Link>
      <Link href="/tables" className="inline-flex min-h-11 items-center rounded-md border border-input px-4 py-2 font-semibold text-link">Your Tables</Link>
    </div>
  </section>;
}
