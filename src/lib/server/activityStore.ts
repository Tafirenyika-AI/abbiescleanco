import { prisma, isDatabaseConfigured } from "@/lib/db";
import { adminNotificationTypeLabels, type AdminNotificationTypeValue } from "@/lib/server/notificationStore";

export interface ActivityItem {
  id: string;
  source: "notification" | "audit";
  label: string;
  title: string;
  description: string;
  link: string | null;
  createdAt: string;
}

function summarizeAuditAction(action: string): string {
  const labels: Record<string, string> = {
    "lead.status_changed": "Lead status changed",
    "lead.deleted": "Lead deleted",
    "booking.status_changed": "Booking status changed",
    "quote.status_changed": "Quote status changed",
  };
  return labels[action] ?? action;
}

/**
 * A single combined, chronological feed across admin notifications (customer-facing
 * events like new leads/payments) and the audit log (admin-driven status changes) —
 * a lighter-weight "what's happening" view than digging through both separately.
 */
export async function getActivityFeed(limit = 60): Promise<ActivityItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];

  const [notifications, auditLogs] = await Promise.all([
    prisma.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { adminUser: true } }),
  ]);

  const notificationItems: ActivityItem[] = notifications.map((n) => ({
    id: `notification:${n.id}`,
    source: "notification",
    label: adminNotificationTypeLabels[n.type as AdminNotificationTypeValue] ?? n.type,
    title: n.title,
    description: n.body,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  }));

  const auditItems: ActivityItem[] = auditLogs.map((a) => ({
    id: `audit:${a.id}`,
    source: "audit",
    label: summarizeAuditAction(a.action),
    title: a.adminUser?.name ? `${a.adminUser.name}` : "System",
    description: `${a.entityType} ${a.entityId.slice(0, 8)}…`,
    link: a.entityType === "lead" ? `/admin/leads/${a.entityId}` : a.entityType === "booking" ? `/admin/bookings/${a.entityId}` : a.entityType === "quote" ? `/admin/quotes/${a.entityId}` : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return [...notificationItems, ...auditItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
