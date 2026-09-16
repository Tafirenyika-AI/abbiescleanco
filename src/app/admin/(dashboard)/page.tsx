import Link from "next/link";
import { ArrowRight, Inbox, FileQuestion, Layers } from "lucide-react";
import { listLeads } from "@/lib/server/leadStore";
import { isDatabaseConfigured } from "@/lib/db";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import Badge from "@/components/admin/ui/Badge";

export default async function AdminDashboardPage() {
  const leads = await listLeads();
  const newLeads = leads.filter((l) => l.status === "NEW");

  const serviceCounts = new Map<string, number>();
  for (const lead of leads) {
    serviceCounts.set(lead.input.service, (serviceCounts.get(lead.input.service) ?? 0) + 1);
  }
  const popularServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = popularServices[0]?.[1] ?? 0;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Good morning</h1>
        <p className="mt-1 text-sm text-admin-text-muted">Here&apos;s what&apos;s happening with your cleaning business today.</p>
      </div>

      {!isDatabaseConfigured && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-admin-text">
          No DATABASE_URL is configured — showing leads from the local mock store
          (<code>.data/leads.json</code>). Set DATABASE_URL to switch to Postgres/Supabase.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">New leads</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-admin-teal/10 text-admin-teal-hover">
              <Inbox className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-admin-text">{newLeads.length}</p>
          <Link href="/admin/leads" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
            View leads <ArrowRight className="size-3" aria-hidden />
          </Link>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">Total leads</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-admin-teal/10 text-admin-teal-hover">
              <Layers className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-admin-text">{leads.length}</p>
          <Link href="/admin/leads" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
            View leads <ArrowRight className="size-3" aria-hidden />
          </Link>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">Manual-quote requests</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-admin-teal/10 text-admin-teal-hover">
              <FileQuestion className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-admin-text">
            {leads.filter((l) => l.estimate.requiresManualQuote).length}
          </p>
          <Link href="/admin/leads" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
            View leads <ArrowRight className="size-3" aria-hidden />
          </Link>
        </Card>
      </div>

      <Card className="mt-6">
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
                  <div
                    className="h-full rounded-full bg-admin-teal"
                    style={{ width: `${maxCount ? (count / maxCount) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge tone="info">Bookings, calendar, quotes, and revenue reporting are on the roadmap</Badge>
      </div>
    </div>
  );
}
