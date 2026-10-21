import { PageLayout } from "@/components/page-layout";
import { BackLink } from "@/components/plate-content";

export default function NewTableLoading() {
  return <PageLayout title="Create a Table" backLink={<BackLink href="/tables">Your Tables</BackLink>}>
    <p role="status" className="text-sm text-muted-foreground">Getting your Table ready…</p>
  </PageLayout>;
}
