import { prisma, isDatabaseConfigured } from "@/lib/db";

export const ADMIN_NOTIFICATION_TYPES = [
  "NEW_LEAD",
  "QUOTE_ACCEPTED",
  "QUOTE_DECLINED",
  "BOOKING_REQUESTED",
  "BOOKING_CANCELLED",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "REVIEW_RECEIVED",
  "ADMIN_USER_CHANGED",
  "PRICING_CHANGED",
  "GENERAL",
] as const;
export type AdminNotificationTypeValue = (typeof ADMIN_NOTIFICATION_TYPES)[number];

export const adminNotificationTypeLabels: Record<AdminNotificationTypeValue, string> = {
  NEW_LEAD: "New lead",
  QUOTE_ACCEPTED: "Quote accepted",
  QUOTE_DECLINED: "Quote declined",
  BOOKING_REQUESTED: "Booking requested",
  BOOKING_CANCELLED: "Booking cancelled",
  PAYMENT_RECEIVED: "Payment received",
  PAYMENT_FAILED: "Payment failed",
  REVIEW_RECEIVED: "Review received",
  ADMIN_USER_CHANGED: "Admin user changed",
  PRICING_CHANGED: "Pricing changed",
  GENERAL: "General",
};

export interface AdminNotificationItem {
  id: string;
  type: AdminNotificationTypeValue;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Fire-and-forget: notification creation should never break the action that
 * triggered it (a lead submitting a quote shouldn't fail because the
 * notifications table had a hiccup), so callers don't need to await/handle
 * errors from this.
 */
export async function notifyAdmins(type: AdminNotificationTypeValue, title: string, body: string, link?: string): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  try {
    await prisma.adminNotification.create({ data: { type, title, body, link } });
  } catch {
    // best-effort — never let a notification failure break the real action
  }
}

export async function listAdminNotifications(limit = 50): Promise<AdminNotificationItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const rows = await prisma.adminNotification.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    isRead: r.isRead,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function countUnreadNotifications(): Promise<number> {
  if (!isDatabaseConfigured || !prisma) return 0;
  return prisma.adminNotification.count({ where: { isRead: false } });
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  await prisma.adminNotification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  await prisma.adminNotification.updateMany({ where: { isRead: false }, data: { isRead: true } });
}
