import { listAdminNotifications } from "@/lib/server/notificationStore";
import NotificationsView from "@/components/admin/notifications/NotificationsView";

export default async function AdminNotificationsPage() {
  const notifications = await listAdminNotifications(200);
  return <NotificationsView initialNotifications={notifications} />;
}
