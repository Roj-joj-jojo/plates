import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/page-layout";
import { signedInClient } from "@/lib/supabase/connected";
import { pictures } from "@/lib/supabase/pictures";
import { PictureAvatar } from "@/components/picture-avatar";

export const metadata: Metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const supabase = await signedInClient();
  const { data: groups, error } = await supabase.from("groups")
    .select("id, name, created_at").eq("availability", "available")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const tablePictures = await pictures(supabase, "table", (groups ?? []).map(group => group.id));
  return (
    <PageLayout title="Your Tables" description="Private spaces for food and conversation."
      actions={<Button asChild><Link href="/tables/new"><Plus aria-hidden="true" />Create a Table</Link></Button>}>
      <section><h2 className="font-display text-xl font-bold">Tables you belong to</h2>
        {groups?.length ? <ul className="mt-4 space-y-3">{groups.map((group) => <li key={group.id}>
          <Link href={`/tables/${group.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-card p-5 font-semibold text-link hover:bg-muted">
            <PictureAvatar name={group.name} url={tablePictures.get(group.id)?.url} table className="size-11 shrink-0" />
            <span className="min-w-0 break-words">{group.name}</span>
          </Link>
        </li>)}</ul> : <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">You have no Tables yet. Create one to start a conversation with people you know.</p>
          <Button asChild variant="outline" className="mt-4"><Link href="/tables/new">Create your first Table</Link></Button>
        </div>}
      </section>
    </PageLayout>
  );
}
