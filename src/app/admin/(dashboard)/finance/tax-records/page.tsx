import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { AlertTriangle, FileText, TrendingUp, TrendingDown, Wallet, Users2 } from "lucide-react";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getTaxYearSummary, getAvailableTaxYears } from "@/lib/server/taxStore";
import Card from "@/components/admin/ui/Card";
import StatCard from "@/components/admin/ui/StatCard";
import Badge from "@/components/admin/ui/Badge";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default async function AdminTaxRecordsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_TAX_RECORDS")) redirect("/admin");

  const availableYears = await getAvailableTaxYears();
  const { year: yearParam } = await searchParams;
  const year = yearParam && availableYears.includes(Number(yearParam)) ? Number(yearParam) : availableYears[0];
  const summary = await getTaxYearSummary(year);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">Tax records</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            Real revenue and expense totals for filing season, computed live from actual payments and expenses -- not a tax calculator, and not a substitute for your accountant.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-admin-border bg-admin-card p-1">
          {availableYears.map((y) => (
            <Link key={y} href={`/admin/finance/tax-records?year=${y}`} className={`ios-press rounded-full px-3.5 py-1.5 text-xs font-semibold ${y === year ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-stats">
        <StatCard label="Revenue" value={money(summary.revenueCents)} icon={TrendingUp} hint="Real payments collected, net of refunds" />
        <StatCard label="Deductible expenses" value={money(summary.deductibleExpensesCents)} icon={TrendingDown} href="/admin/expenses" />
        <StatCard label="Net estimate" value={money(summary.netEstimateCents)} icon={Wallet} hint="Revenue minus deductible expenses, not a tax liability" />
        <StatCard label="Subcontractor payouts" value={money(summary.subcontractorPayouts.reduce((sum, p) => sum + p.totalCents, 0))} icon={Users2} href="/admin/finance/subcontractors" />
      </div>

      {summary.nonDeductibleExpensesCents > 0 && (
        <p className="text-xs text-admin-text-muted">Plus {money(summary.nonDeductibleExpensesCents)} in real expenses marked not tax-deductible this year, excluded from the deductible total above.</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-admin-text">Deductible expenses by category</h2>
          {summary.expensesByCategory.length === 0 ? (
            <p className="mt-2 text-sm text-admin-text-muted">No expenses recorded for {year}.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {summary.expensesByCategory.map((c) => (
                <li key={c.category} className="flex justify-between gap-3">
                  <span className="text-admin-text-muted">{c.label}</span>
                  <span className="font-medium text-admin-text">{money(c.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-admin-text">Subcontractor 1099 recordkeeping</h2>
          <p className="mt-1 text-xs text-admin-text-muted">Real payouts per subcontractor this year. $600+ is the real US 1099-NEC threshold -- informational only, confirm with your accountant before filing.</p>
          {summary.subcontractorPayouts.length === 0 ? (
            <p className="mt-2 text-sm text-admin-text-muted">No subcontractor payouts recorded for {year}.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {summary.subcontractorPayouts.map((p) => (
                <li key={p.subcontractorId} className="flex items-center justify-between gap-3">
                  <Link href={`/admin/finance/subcontractors/${p.subcontractorId}`} className="text-admin-teal-hover hover:underline">{p.name}</Link>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-admin-text">{money(p.totalCents)}</span>
                    {p.requires1099 && <Badge tone="warning">1099 likely required</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-start gap-2.5">
          <FileText className="mt-0.5 size-4 shrink-0 text-admin-teal-hover" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-admin-text">Tax documents</p>
            <p className="mt-1 text-sm text-admin-text-muted">
              EIN letters, business license, filed returns, quarterly estimated payment confirmations -- stored in the <Link href="/admin/finance/documents" className="text-admin-teal-hover hover:underline">Documents vault</Link>, filtered to category &quot;Tax document&quot;.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>These are real, computed totals from your actual payments and expenses -- not tax advice, and not a calculation of what you actually owe. Confirm everything with your accountant before filing.</p>
      </div>
    </div>
  );
}
