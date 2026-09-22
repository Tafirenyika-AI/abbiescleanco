import Link from "next/link";
import { ArrowRight, Inbox, FileQuestion, TrendingUp, CalendarClock, DollarSign, Target, AlertCircle } from "lucide-react";
import { listLeads } from "@/lib/server/leadStore";
import { listQuotes } from "@/lib/server/quoteStore";
import { listBookingsInRange } from "@/lib/server/bookingStore";
import { getReportsSummary } from "@/lib/server/reportsStore";
import { isDatabaseConfigured } from "@/lib/db";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatCard from "@/components/admin/ui/StatCard";
import GaugeRing from "@/components/admin/ui/GaugeRing";
import { formatDateTime } from "@/lib/adminDate";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const rangeStart30 = new Date(now);
  rangeStart30.setDate(rangeStart30.getDate() - 29);
  rangeStart30.setHours(0, 0, 0, 0);
  const rangeStart7 = new Date(now);
  rangeStart7.setDate(rangeStart7.getDate() - 6);
  rangeStart7.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [leads, quotes, report, upcomingBookings] = await Promise.all([
    listLeads(),
    listQuotes(),
    getReportsSummary(rangeStart30, now),
    listBookingsInRange(now.toISOString(), weekEnd.toISOString()),
  ]);

  const newLeads = leads.filter((l) => l.status === "NEW");
  const leadsThisWeek = leads.filter((l) => new Date(l.createdAt) >= rangeStart7).length;
  const sentQuotes = quotes.filter((q) => q.status === "SENT");
  const pipelineValue = sentQuotes.reduce((sum, q) => sum + q.total, 0);
  const expiringQuotes = sentQuotes.filter((q) => q.expiresAt && new Date(q.expiresAt).getTime() - now.getTime() < 3 * 86400000);
  const unconfirmedBookings = upcomingBookings.filter((b) => b.status === "REQUESTED");
  const topOpportunities = [...sentQuotes].sort((a, b) => b.total - a.total).slice(0, 5);
  const nextBookings = upcomingBookings.filter((b) => ["CONFIRMED", "SCHEDULED"].includes(b.status)).slice(0, 5);

  const serviceCounts = new Map<string, number>();
  for (const lead of leads) serviceCounts.set(lead.input.service, (serviceCounts.get(lead.input.service) ?? 0) + 1);
  const popularServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = popularServices[0]?.[1] ?? 0;

  const attentionItems = [
    newLeads.length > 0 && { label: `${newLeads.length} new lead${newLeads.length === 1 ? "" : "s"} awaiting first contact`, href: "/admin/leads" },
    expiringQuotes.length > 0 && { label: `${expiringQuotes.length} quote${expiringQuotes.length === 1 ? "" : "s"} expiring within 3 days`, href: "/admin/quotes" },
    unconfirmedBookings.length > 0 && { label: `${unconfirmedBookings.length} booking${unconfirmedBookings.length === 1 ? "" : "s"} this week still need confirming`, href: "/admin/bookings" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">{greeting()}</h1>
          <p className="mt-1 text-sm text-admin-text-muted">Here&apos;s what&apos;s happening with your cleaning business today.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-success/10 px-3 py-1 text-xs font-semibold text-admin-success">
          <span className="size-1.5 rounded-full bg-admin-success" aria-hidden /> Live business overview
        </span>
      </div>

      {!isDatabaseConfigured && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-admin-text">
          No DATABASE_URL is configured — showing leads from the local mock store
          (<code>.data/leads.json</code>). Set DATABASE_URL to switch to Postgres/Supabase.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pipeline value" value={money(pipelineValue)} icon={TrendingUp} href="/admin/quotes" hint={`${sentQuotes.length} quote${sentQuotes.length === 1 ? "" : "s"} awaiting a decision`} />
        <StatCard label="New leads" value={String(newLeads.length)} icon={Inbox} href="/admin/leads" hint={`${leadsThisWeek} this week`} />
        <StatCard label="Bookings, next 7 days" value={String(upcomingBookings.length)} icon={CalendarClock} href="/admin/bookings" hint={unconfirmedBookings.length > 0 ? `${unconfirmedBookings.length} need confirming` : "all confirmed"} />
        <StatCard label="Quote conversion (30d)" value={report.conversionRate != null ? `${Math.round(report.conversionRate * 100)}%` : "—"} icon={Target} href="/admin/reports" />
        <StatCard label="Net revenue (30d)" value={money(report.netRevenue)} icon={DollarSign} href="/admin/reports" />
      </div>

      {attentionItems.length > 0 && (
        <Card className="mt-6 border-none bg-gradient-to-br from-admin-navy to-admin-teal text-white shadow-[0_8px_24px_rgba(11,23,57,0.18)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4.5" aria-hidden />
            <h2 className="font-semibold">Needs your attention</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {attentionItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-medium hover:bg-white/15">
                  {item.label}
                  <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-admin-text">Top opportunities</h2>
            <Link href="/admin/quotes" className="text-xs font-semibold text-admin-teal-hover hover:underline">View all quotes</Link>
          </div>
          {topOpportunities.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={FileQuestion} title="No open quotes" description="Quotes you've sent that are awaiting a customer decision will show up here, largest first." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-admin-border">
              {topOpportunities.map((q) => (
                <li key={q.id}>
                  <Link href={`/admin/quotes/${q.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-admin-text">{q.customerName}</p>
                      <p className="truncate text-xs text-admin-text-muted">{q.serviceName} · {q.quoteNumber}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-admin-text">{money(q.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col items-center justify-center text-center">
          <h2 className="self-start font-semibold text-admin-text">Business health</h2>
          <div className="mt-2">
            <GaugeRing value={report.conversionRate != null ? report.conversionRate * 100 : 0} label="Quote conversion (30d)" />
          </div>
          <dl className="mt-2 grid w-full grid-cols-2 gap-3 text-left">
            <div>
              <dt className="text-xs text-admin-text-muted">Sent</dt>
              <dd className="text-sm font-semibold text-admin-text">{report.quotesSent}</dd>
            </div>
            <div>
              <dt className="text-xs text-admin-text-muted">Accepted</dt>
              <dd className="text-sm font-semibold text-admin-text">{report.quotesAccepted}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-admin-text">Upcoming bookings</h2>
          {nextBookings.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={CalendarClock} title="Nothing confirmed in the next 7 days" description="Confirmed and scheduled bookings will appear here." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-admin-border">
              {nextBookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-admin-text">{b.customerName}</p>
                      <p className="truncate text-xs text-admin-text-muted">{b.serviceName}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-admin-text-muted">{b.scheduledStart ? formatDateTime(b.scheduledStart) : "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-admin-text">Popular services</h2>
          {popularServices.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="No leads yet"
                description="New quote and contact requests will appear here."
                action={
                  <Link href="/estimate" className="text-sm font-semibold text-admin-teal-hover hover:underline">
                    View public quote form →
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {popularServices.map(([service, count]) => (
                <li key={service}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-admin-text">{service}</span>
                    <span className="font-semibold text-admin-text">{count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-admin-bg">
                    <div className="h-full rounded-full bg-admin-teal" style={{ width: `${maxCount ? (count / maxCount) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
