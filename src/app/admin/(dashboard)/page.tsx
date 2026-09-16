import Link from "next/link";
import { listLeads } from "@/lib/server/leadStore";
import { isDatabaseConfigured } from "@/lib/db";

export default async function AdminDashboardPage() {
  const leads = await listLeads();
  const newLeads = leads.filter((l) => l.status === "NEW");

  const serviceCounts = new Map<string, number>();
  for (const lead of leads) {
    serviceCounts.set(lead.input.service, (serviceCounts.get(lead.input.service) ?? 0) + 1);
  }
  const popularServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-950">Dashboard</h1>

      {!isDatabaseConfigured && (
        <p className="mt-3 rounded-xl bg-warm-100 p-3 text-sm text-navy-900">
          No DATABASE_URL is configured — showing leads from the local mock store
          (<code>.data/leads.json</code>). Set DATABASE_URL to switch to Postgres/Supabase.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-surface-200 bg-white p-5">
          <p className="text-sm text-surface-700">New leads</p>
          <p className="mt-1 text-3xl font-semibold text-navy-950">{newLeads.length}</p>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-5">
          <p className="text-sm text-surface-700">Total leads</p>
          <p className="mt-1 text-3xl font-semibold text-navy-950">{leads.length}</p>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-white p-5">
          <p className="text-sm text-surface-700">Manual-quote requests</p>
          <p className="mt-1 text-3xl font-semibold text-navy-950">
            {leads.filter((l) => l.estimate.requiresManualQuote).length}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-surface-200 bg-white p-5">
        <h2 className="font-semibold text-navy-950">Popular services</h2>
        {popularServices.length === 0 ? (
          <p className="mt-2 text-sm text-surface-700">No leads yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {popularServices.map(([service, count]) => (
              <li key={service} className="flex items-center justify-between text-sm">
                <span className="text-navy-900">{service}</span>
                <span className="font-semibold text-navy-950">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <Link href="/admin/leads" className="text-sm font-semibold text-teal-600 hover:underline">
          View all leads →
        </Link>
      </div>

      <p className="mt-10 text-xs text-surface-700">
        Bookings, calendar, quote management, and revenue reporting are part of Phase 3/4 of the
        implementation roadmap — see README.md.
      </p>
    </div>
  );
}
