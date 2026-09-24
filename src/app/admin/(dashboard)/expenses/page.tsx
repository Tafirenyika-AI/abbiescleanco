import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listExpenses } from "@/lib/server/expenseStore";
import ExpensesView from "@/components/admin/expenses/ExpensesView";

export default async function AdminExpensesPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "FINANCE_VIEW")) {
    redirect("/admin");
  }

  const expenses = await listExpenses();
  return <ExpensesView initialExpenses={expenses} />;
}
