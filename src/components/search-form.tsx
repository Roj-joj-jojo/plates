import { Button } from "@/components/ui/button";

export function SearchForm({ action, query, label = "Search", placeholder, hiddenFields = {} }: {
  action: string; query: string; label?: string; placeholder: string; hiddenFields?: Record<string, string>;
}) {
  return <form action={action} method="get" className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-end">
    {Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <label className="flex-1 text-sm font-semibold">{label}
      <input name="q" type="search" defaultValue={query} maxLength={100} required
        placeholder={placeholder} className="mt-2 min-h-11 w-full rounded-md border border-input bg-card px-3 py-3 font-normal" />
    </label>
    <Button type="submit">Search</Button>
  </form>;
}
