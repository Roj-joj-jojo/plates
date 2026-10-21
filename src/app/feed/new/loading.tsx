import { BackLink } from "@/components/plate-content";
import { PageLayout } from "@/components/page-layout";

export default function NewPlateLoading() {
  return <PageLayout title="Add a Plate" backLink={<BackLink href="/feed">Feed</BackLink>}>
    <p role="status" className="mt-6 text-sm text-muted-foreground">Getting your Plate ready…</p>
  </PageLayout>;
}
