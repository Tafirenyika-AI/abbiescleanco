import { listExpenses } from "@/lib/server/expenseStore";
import ExpensesView from "@/components/admin/expenses/ExpensesView";

export default async function AdminExpensesPage() {
  const expenses = await listExpenses();
  return <ExpensesView initialExpenses={expenses} />;
}
