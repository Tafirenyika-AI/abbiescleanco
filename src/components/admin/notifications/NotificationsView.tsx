"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCheck, Bell } from "lucide-react";
import type { AdminNotificationItem, AdminNotificationTypeValue } from "@/lib/server/notificationStore";
import { ADMIN_NOTIFICATION_TYPES, adminNotificationTypeLabels } from "@/lib/server/notificationStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";

export default function NotificationsView({ initialNotifications }: { initialNotifications: AdminNotificationItem[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [typeFilter, setTypeFilter] = useState<AdminNotificationTypeValue | "ALL">("ALL");

  const filtered = notifications.filter((n) => typeFilter === "ALL" || n.type === typeFilter);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/admin/notifications/mark-all-read", { method: "PATCH" });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Notifications</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{notifications.length} total · {unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className="ios-press inline-flex items-center gap-1.5 rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
            <CheckCheck className="size-4" aria-hidden /> Mark all read
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-full border border-admin-border bg-admin-card p-1">
        <button type="button" onClick={() => setTypeFilter("ALL")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === "ALL" ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
          All
        </button>
        {ADMIN_NOTIFICATION_TYPES.filter((t) => notifications.some((n) => n.type === t)).map((t) => (
          <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === t ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
            {adminNotificationTypeLabels[t]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <Card><EmptyState icon={Bell} title="No notifications" description="New leads, quote responses, payments, and reviews will show up here." /></Card>
        ) : (
          filtered.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-70" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="size-1.5 shrink-0 rounded-full bg-admin-teal" aria-hidden />}
                    <p className="font-semibold text-admin-text">{n.title}</p>
                    <Badge tone="neutral">{adminNotificationTypeLabels[n.type]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-admin-text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-admin-text-muted">{new Date(n.createdAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {n.link && (
                    <Link href={n.link} className="text-xs font-semibold text-admin-teal-hover hover:underline">
                      View
                    </Link>
                  )}
                  {!n.isRead && (
                    <button type="button" onClick={() => markRead(n.id)} className="text-xs text-admin-text-muted hover:text-admin-text">
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
