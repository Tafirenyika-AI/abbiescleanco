import Link from "next/link";
import { getActivityFeed } from "@/lib/server/activityStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { formatDateTime } from "@/lib/adminDate";
import { Activity } from "lucide-react";

export default async function AdminActivityPage() {
  const feed = await getActivityFeed(80);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Activity</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          A combined, at-a-glance feed of recent events, new leads and payments alongside admin status changes.
          For a filterable record of exactly what changed, see the <Link href="/admin/audit-log" className="text-admin-teal-hover hover:underline">audit log</Link>.
        </p>
      </div>

      <div className="mt-4">
        {feed.length === 0 ? (
          <Card><EmptyState icon={Activity} title="No activity yet" description="New leads, payments, and status changes will show up here as they happen." /></Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-admin-border">
              {feed.map((item) => (
                <li key={item.id} className="flex items-start gap-3 p-3.5">
                  <Badge tone={item.source === "notification" ? "info" : "neutral"}>{item.label}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-admin-text">{item.title}</p>
                    {item.description && <p className="text-sm text-admin-text-muted">{item.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-admin-text-muted whitespace-nowrap">{formatDateTime(item.createdAt)}</span>
                    {item.link && <Link href={item.link} className="text-xs font-semibold text-admin-teal-hover hover:underline">view</Link>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
