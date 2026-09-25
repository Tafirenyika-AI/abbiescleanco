import Link from "next/link";
import { getReportsSummary } from "@/lib/server/reportsStore";
import Card from "@/components/admin/ui/Card";
import ExportCsvButton from "@/components/admin/reports/ExportCsvButton";
import { leadStatusLabels, type LeadStatusValue } from "@/lib/leads";

type RangeKey = "today" | "7d" | "30d" | "month" | "prev-month";

const rangeLabels: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  "prev-month": "Previous month",
};

function computeRange(key: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (key === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (key === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (key === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (key === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end };
  }
  // prev-month
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end: prevEnd };
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-admin-text">{label}</span>
        <span className="font-semibold text-admin-text">{count}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-admin-bg">
        <div className="h-full rounded-full bg-admin-teal" style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const rangeKey: RangeKey = (range as RangeKey) in rangeLabels ? (range as RangeKey) : "30d";
  const { start, end } = computeRange(rangeKey);
  const report = await getReportsSummary(start, end);

  const maxSource = Math.max(1, ...report.leadsBySource.map((s) => s.count));
  const maxService = Math.max(1, ...report.leadsByService.map((s) => s.count));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Reports</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            {start.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })} – {end.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-full border border-admin-border bg-admin-card p-1">
          {(Object.keys(rangeLabels) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={`/admin/reports?range=${key}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                rangeKey === key ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"
              }`}
            >
              {rangeLabels[key]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Leads</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.leadsCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Quotes sent</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.quotesSent}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Lead → accepted quote</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.conversionRate === null ? "—" : `${Math.round(report.conversionRate * 100)}%`}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Accepted quote value</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(report.acceptedValue / 100).toLocaleString("en-US")}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Bookings scheduled</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.bookingsScheduledOrConfirmed}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Bookings completed</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.bookingsCompleted}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Cancellation rate</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.cancellationRate === null ? "—" : `${Math.round(report.cancellationRate * 100)}%`}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Quotes declined</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{report.quotesDeclined}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Expenses</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(report.totalExpenses / 100).toLocaleString("en-US")}</p>
        </Card>
        <Card className="sm:col-span-2">
          <p className="text-sm font-medium text-admin-text-muted">Net revenue (real collected, net of refunds − expenses)</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(report.netRevenue / 100).toLocaleString("en-US")}</p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-admin-text">Leads by source</h2>
            <ExportCsvButton
              filename={`leads-by-source-${rangeKey}.csv`}
              rows={report.leadsBySource.map((s) => ({ source: s.source, count: s.count }))}
            />
          </div>
          {report.leadsBySource.length === 0 ? (
            <p className="mt-3 text-sm text-admin-text-muted">No leads in this range.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {report.leadsBySource.map((s) => (
                <Bar key={s.source} label={s.source} count={s.count} max={maxSource} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-admin-text">Leads by status</h2>
          {report.leadsByStatus.length === 0 ? (
            <p className="mt-3 text-sm text-admin-text-muted">No leads in this range.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.leadsByStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-sm">
                  <span className="text-admin-text">{leadStatusLabels[s.status as LeadStatusValue] ?? s.status}</span>
                  <span className="font-semibold text-admin-text">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-admin-text">Popular services</h2>
            <ExportCsvButton
              filename={`popular-services-${rangeKey}.csv`}
              rows={report.leadsByService.map((s) => ({ service: s.service, count: s.count }))}
            />
          </div>
          {report.leadsByService.length === 0 ? (
            <p className="mt-3 text-sm text-admin-text-muted">No leads in this range.</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.leadsByService.map((s) => (
                <Bar key={s.service} label={s.service} count={s.count} max={maxService} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs text-admin-text-muted">
        Team-member-level performance breakdowns aren&apos;t available yet, see the Team page for per-cleaner assigned/completed job counts.
      </p>
    </div>
  );
}
