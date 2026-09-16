import Link from "next/link";
import { listAuditLogs, listAuditEntityTypes } from "@/lib/server/auditLogStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { ScrollText } from "lucide-react";

const entityHref: Record<string, (id: string) => string> = {
  lead: (id) => `/admin/leads`,
  quote: (id) => `/admin/quotes/${id}`,
  booking: (id) => `/admin/bookings/${id}`,
  customer: (id) => `/admin/customers/${id}`,
};

function summarizeDiff(before: unknown, after: unknown): string {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return "";
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(a)) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      parts.push(`${key}: ${String(b[key] ?? "—")} → ${String(a[key] ?? "—")}`);
    }
  }
  return parts.join(", ");
}

export default async function AdminAuditLogPage({ searchParams }: { searchParams: Promise<{ entityType?: string }> }) {
  const { entityType } = await searchParams;
  const [logs, entityTypes] = await Promise.all([listAuditLogs({ entityType }), listAuditEntityTypes()]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Audit log</h1>
        <p className="mt-1 text-sm text-admin-text-muted">{logs.length} entries · every pricing, status, and account change made by an admin</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-full border border-admin-border bg-admin-card p-1">
        <Link href="/admin/audit-log" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!entityType ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
          All
        </Link>
        {entityTypes.map((t) => (
          <Link key={t} href={`/admin/audit-log?entityType=${t}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${entityType === t ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {logs.length === 0 ? (
          <Card><EmptyState icon={ScrollText} title="No activity yet" description="Status changes, pricing edits, and account changes will show up here." /></Card>
        ) : (
          <Card padded={false}>
            <table className="w-full text-left text-sm">
              <thead className="bg-admin-bg">
                <tr>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">When</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Admin</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Action</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Entity</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Change</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const href = entityHref[l.entityType]?.(l.entityId);
                  return (
                    <tr key={l.id} className="border-t border-admin-border">
                      <td className="p-3.5 whitespace-nowrap text-admin-text-muted">{new Date(l.createdAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</td>
                      <td className="p-3.5 text-admin-text">{l.adminName ?? "System"}</td>
                      <td className="p-3.5 text-admin-text">{l.action.replace(/[._]/g, " ")}</td>
                      <td className="p-3.5">
                        <Badge tone="neutral">{l.entityType}</Badge>
                        {href && <Link href={href} className="ml-2 text-xs text-admin-teal-hover hover:underline">view</Link>}
                      </td>
                      <td className="p-3.5 text-admin-text-muted">{summarizeDiff(l.before, l.after) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
