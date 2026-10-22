import { ViewNavigation } from "@/components/view-navigation";

export function MenuViews({ own = false, query = "" }: { own?: boolean; query?: string }) {
  return <ViewNavigation label="Menu views" items={[
    { href: query ? `/menu?q=${encodeURIComponent(query)}` : "/menu", label: "Saved", active: !own },
    { href: "/menu?view=plates", label: "Your Plates", active: own },
  ]} />;
}
