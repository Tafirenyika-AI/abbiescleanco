import Link from "next/link";
import { ArrowRight, Inbox, FileQuestion, TrendingUp, CalendarClock, DollarSign, Target, AlertCircle, UserRoundX, Plus, Users2 } from "lucide-react";
import { listLeads } from "@/lib/server/leadStore";
import { listQuotes } from "@/lib/server/quoteStore";
import { listBookingsInRange } from "@/lib/server/bookingStore";
import { getReportsSummary, getDailyRevenue } from "@/lib/server/reportsStore";
import { getActivityFeed } from "@/lib/server/activityStore";
import { listTeamMembers } from "@/lib/server/teamStore";
import { isDatabaseConfigured } from "@/lib/db";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatCard from "@/components/admin/ui/StatCard";
import GaugeRing from "@/components/admin/ui/GaugeRing";
import BarChart from "@/components/admin/ui/BarChart";
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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const quickActions = [
  { label: "New lead", href: "/admin/leads/new" },
  { label: "New quote", href: "/admin/quotes/new" },
  { label: "New booking", href: "/admin/bookings/new" },
  { label: "New customer", href: "/admin/customers/new" },
];

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

  const [leads, quotes, report, upcomingBookings, activity, team, dailyRevenue] = await Promise.all([
    listLeads(),
    listQuotes(),
    getReportsSummary(rangeStart30, now),
    listBookingsInRange(now.toISOString(), weekEnd.toISOString()),
    getActivityFeed(6),
    listTeamMembers(),
    getDailyRevenue(7),
  ]);

  const newLeads = leads.filter((l) => l.status === "NEW");
  const leadsThisWeek = leads.filter((l) => new Date(l.createdAt) >= rangeStart7).length;
  const sentQuotes = quotes.filter((q) => q.status === "SENT");
  const pipelineValue = sentQuotes.reduce((sum, q) => sum + q.total, 0);
  const expiringQuotes = sentQuotes.filter((q) => q.expiresAt && new Date(q.expiresAt).getTime() - now.getTime() < 3 * 86400000);
  const unconfirmedBookings = upcomingBookings.filter((b) => b.status === "REQUESTED");
  const unassignedBookings = upcomingBookings.filter((b) => !b.staffAssignee && !["CANCELLED", "COMPLETED"].includes(b.status));
  const topOpportunities = [...sentQuotes].sort((a, b) => b.total - a.total).slice(0, 5);
  const nextBookings = upcomingBookings.filter((b) => ["CONFIRMED", "SCHEDULED", "ON_THE_WAY"].includes(b.status)).slice(0, 5);

  // Real 7-day lead volume, oldest first, for the "New leads" sparkline -- no separate query, just bucketing what we already fetched.
  const leadsPerDay: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    leadsPerDay.push(leads.filter((l) => { const t = new Date(l.createdAt).getTime(); return t >= dayStart.getTime() && t <= dayEnd.getTime(); }).length);
  }

  const serviceCounts = new Map<string, number>();
  for (const lead of leads) serviceCounts.set(lead.input.service, (serviceCounts.get(lead.input.service) ?? 0) + 1);
  const popularServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = popularServices[0]?.[1] ?? 0;

  const attentionItems = [
    newLeads.length > 0 && { label: `${newLeads.length} new lead${newLeads.length === 1 ? "" : "s"} awaiting first contact`, href: "/admin/leads" },
    expiringQuotes.length > 0 && { label: `${expiringQuotes.length} quote${expiringQuotes.length === 1 ? "" : "s"} expiring within 3 days`, href: "/admin/quotes" },
    unconfirmedBookings.length > 0 && { label: `${unconfirmedBookings.length} booking${unconfirmedBookings.length === 1 ? "" : "s"} this week still need confirming`, href: "/admin/bookings" },
  ].filter(Boolean) as { label: string; href: string }[];

  const activeTeam = team.filter((t) => t.isActive);

  return (
    <div className="admin-dashboard">
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
          No DATABASE_URL is configured, showing leads from the local mock store
          (<code>.data/leads.json</code>). Set DATABASE_URL to switch to Postgres/Supabase.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div>
          <div className="admin-stats">
            <StatCard label="Pipeline value" value={money(pipelineValue)} icon={TrendingUp} href="/admin/quotes" hint={`${sentQuotes.length} quote${sentQuotes.length === 1 ? "" : "s"} awaiting a decision`} />
            <StatCard label="New leads" value={String(newLeads.length)} icon={Inbox} href="/admin/leads" hint={`${leadsThisWeek} this week`} spark={leadsPerDay} />
            <StatCard label="Bookings, next 7 days" value={String(upcomingBookings.length)} icon={CalendarClock} href="/admin/bookings" hint={unconfirmedBookings.length > 0 ? `${unconfirmedBookings.length} need confirming` : "all confirmed"} />
            <StatCard label="Quote conversion (30d)" value={report.conversionRate != null ? `${Math.round(report.conversionRate * 100)}%` : "—"} icon={Target} href="/admin/reports" />
            <StatCard label="Net revenue (30d)" value={money(report.netRevenue)} icon={DollarSign} href="/admin/reports" hint="real collected, net of refunds & expenses" />
          </div>

          {unassignedBookings.length > 0 && (
            <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-admin-warning/10 text-admin-warning">
                  <UserRoundX className="size-4" aria-hidden />
                </span>
                <p className="text-sm text-admin-text">
                  <strong className="font-semibold">{unassignedBookings.length}</strong> booking{unassignedBookings.length === 1 ? "" : "s"} in the next 7 days {unassignedBookings.length === 1 ? "has" : "have"} no cleaner assigned yet
                </p>
              </div>
              <Link href="/admin/bookings" className="ios-press shrink-0 rounded-full bg-admin-teal px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover">
                Assign now
              </Link>
            </Card>
          )}

          {attentionItems.length > 0 && (
            <Card className="admin-attention mt-4 text-white">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
                  <AlertCircle className="size-4" aria-hidden />
                </span>
                <h2 className="font-semibold">Needs your attention</h2>
              </div>
              <ul className="mt-3 space-y-2">
                {attentionItems.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="ios-press flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm font-medium hover:bg-white/15">
                      {item.label}
                      <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-admin-text">Revenue, last 7 days</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-admin-success"><span className="size-1.5 rounded-full bg-admin-success" aria-hidden /> Live</span>
              </div>
              <div className="mt-3">
                <BarChart data={dailyRevenue.map((d) => ({ label: new Date(d.date).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }), value: d.cents }))} formatValue={money} />
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold text-admin-text">Top performing services</h2>
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

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-admin-text">Top opportunities</h2>
                <Link href="/admin/quotes" className="text-xs font-semibold text-admin-teal-hover hover:underline">View all</Link>
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
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-admin-text">Quick actions</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href} className="ios-press flex items-center gap-1.5 rounded-lg border border-admin-border px-2.5 py-2 text-xs font-semibold text-admin-text hover:bg-admin-bg">
                  <Plus className="size-3.5 shrink-0 text-admin-teal-hover" aria-hidden /> {a.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-admin-text">Recent activity</h2>
              <Link href="/admin/activity" className="text-xs font-semibold text-admin-teal-hover hover:underline">View all</Link>
            </div>
            {activity.length === 0 ? (
              <p className="mt-3 text-xs text-admin-text-muted">Nothing yet, activity across leads, quotes, bookings and payments will show up here.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="text-sm">
                    {item.link ? (
                      <Link href={item.link} className="font-medium text-admin-text hover:text-admin-teal-hover">{item.title}</Link>
                    ) : (
                      <p className="font-medium text-admin-text">{item.title}</p>
                    )}
                    <p className="text-xs text-admin-text-muted">{item.label} · {timeAgo(item.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-admin-text"><Users2 className="size-4" aria-hidden /> Your team</h2>
              <Link href="/admin/team" className="text-xs font-semibold text-admin-teal-hover hover:underline">Manage</Link>
            </div>
            {activeTeam.length === 0 ? (
              <p className="mt-3 text-xs text-admin-text-muted">No active team members yet, add your cleaners to assign them to jobs.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activeTeam.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-admin-teal/10 text-xs font-semibold text-admin-teal-hover">
                      {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-admin-text">{m.name}</p>
                      <p className="truncate text-xs text-admin-text-muted">{m.role || "Cleaner"} · {m.assignedJobs} assigned</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
