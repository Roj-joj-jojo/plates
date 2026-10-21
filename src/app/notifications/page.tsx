import { signedInClient } from "@/lib/supabase/connected";
import { NotificationList } from "@/components/notification-list";
import { PageLayout } from "@/components/page-layout";
import { FollowNotificationList } from "@/components/follow-notification-list";
import { followNotifications } from "@/lib/supabase/follow-notifications";
import { PlateCommentNotificationList } from "@/components/plate-comment-notification-list";
import { plateCommentNotifications } from "@/lib/supabase/plate-interactions";
import { tableActivityReady } from "@/lib/supabase/table-activity";
export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };
export default async function NotificationsPage() {
  const client = await signedInClient();
  let activityReady: boolean | null = null;
  try { activityReady = await tableActivityReady(client); } catch { /* Do not duplicate mentions when readiness cannot be established. */ }
  const { data, error } = activityReady === false ? await client.rpc("my_mention_notifications") : { data: [], error: null };
  let follows = null;
  try { follows = await followNotifications(client); } catch { /* Render a retry message alongside existing mentions. */ }
  let comments = null;
  try { comments = await plateCommentNotifications(client); } catch { /* Preserve other notification sections on failure. */ }
  return <PageLayout title="Notifications" description="Follow requests, new followers, accepted requests and comments on your original Plates. Table updates are under the envelope.">
    {follows ? <FollowNotificationList notifications={follows} /> : <p role="alert" className="text-destructive">Couldn’t load follow activity. Please refresh to try again.</p>}
    {comments ? <PlateCommentNotificationList notifications={comments} /> : <p role="alert" className="mt-6 text-destructive">Couldn’t load Plate comment activity. Please refresh to try again.</p>}
    {activityReady === false && <><h2 className="mt-8 font-display text-xl font-bold">Mentions</h2>
      {error ? <p role="alert" className="text-destructive">Couldn’t load your notifications. Please try again.</p> : <NotificationList notifications={data ?? []} />}</>}
    {activityReady === null && <p role="alert" className="mt-6 text-sm text-destructive">Couldn’t check Table activity. Please refresh to try again.</p>}
  </PageLayout>;
}
