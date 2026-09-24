"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileWarning, Users2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import StatCard from "@/components/admin/ui/StatCard";
import DonutChart from "@/components/admin/ui/DonutChart";
import DualBarChart from "@/components/admin/ui/DualBarChart";
import type { FinanceOverview, CategoryAmount } from "@/lib/server/financeStore";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const RANGE_LABELS = { today: "Today", month: "This month", year: "This year" } as const;

export default function FinanceDashboard({
  overviews,
  expensesByCategory,
  revenueByService,
  trend,
}: {
  overviews: Record<"today" | "month" | "year", FinanceOverview>;
  expensesByCategory: CategoryAmount[];
  revenueByService: CategoryAmount[];
  trend: { date: string; revenueCents: number; expenseCents: number }[];
}) {
  const [range, setRange] = useState<"today" | "month" | "year">("month");
  const o = overviews[range];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">Finance</h1>
          <p className="mt-1 text-sm text-admin-text-muted">How the business is really doing, from real bookings, payments, and expenses -- nothing here is estimated or invented.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-admin-border bg-admin-card p-1">
          {(["today", "month", "year"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`ios-press rounded-full px-3.5 py-1.5 text-xs font-semibold ${range === r ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Revenue" value={money(o.revenue)} icon={TrendingUp} hint="Accepted quotes in this window" />
        <StatCard label="Collected" value={money(o.collected)} icon={DollarSign} hint="Real payments received, net of refunds" />
        <StatCard label="Estimated profit" value={money(o.estimatedProfit)} icon={Wallet} hint="Collected minus expenses" />
        <StatCard label="Expenses" value={money(o.expenses)} icon={TrendingDown} href="/admin/expenses" />
        <StatCard label="Outstanding invoices" value={money(o.outstandingInvoices)} icon={FileWarning} href="/admin/invoices" hint="Owed right now, any period" />
      </div>

      <Card className="border-dashed">
        <div className="flex items-center gap-2.5 text-sm text-admin-text-muted">
          <Users2 className="size-4 shrink-0" aria-hidden />
          <p>Subcontractor amounts owed aren&apos;t shown yet -- there&apos;s no subcontractor system built yet to compute a real number from (see Workforce in the nav).</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-admin-text">Revenue vs expenses, last 30 days</h2>
          <div className="mt-3">
            <DualBarChart
              data={trend.map((d) => ({ label: new Date(d.date).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }), a: d.revenueCents, b: d.expenseCents }))}
              formatValue={money}
              aLabel="Collected"
              bLabel="Expenses"
            />
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-admin-text">Expenses by category (this month)</h2>
          <div className="mt-3">
            <DonutChart data={expensesByCategory.map((c) => ({ label: c.label, cents: c.cents }))} formatValue={money} />
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-admin-text">Revenue by service (this month)</h2>
        <div className="mt-3">
          <DonutChart data={revenueByService.map((c) => ({ label: c.label, cents: c.cents }))} formatValue={money} />
        </div>
      </Card>
    </div>
  );
}
