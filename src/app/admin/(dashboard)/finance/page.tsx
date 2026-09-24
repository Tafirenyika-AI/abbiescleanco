import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getFinanceOverview, getExpensesByCategory, getRevenueByService, getRevenueVsExpensesTrend } from "@/lib/server/financeStore";
import FinanceDashboard from "@/components/admin/finance/FinanceDashboard";

export default async function AdminFinancePage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "FINANCE_VIEW")) {
    redirect("/admin");
  }

  const [today, month, year, expensesByCategory, revenueByService, trend] = await Promise.all([
    getFinanceOverview("today"),
    getFinanceOverview("month"),
    getFinanceOverview("year"),
    getExpensesByCategory("month"),
    getRevenueByService("month"),
    getRevenueVsExpensesTrend(30),
  ]);

  return (
    <FinanceDashboard
      overviews={{ today, month, year }}
      expensesByCategory={expensesByCategory}
      revenueByService={revenueByService}
      trend={trend}
    />
  );
}
