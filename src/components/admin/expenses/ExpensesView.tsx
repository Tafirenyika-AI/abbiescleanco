"use client";

import { useState } from "react";
import { Plus, Trash2, Receipt as ReceiptIcon } from "lucide-react";
import type { ExpenseItem, ExpenseCategoryValue } from "@/lib/server/expenseStore";
import { EXPENSE_CATEGORIES, expenseCategoryLabels } from "@/lib/server/expenseStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatCalendarDate } from "@/lib/adminDate";

const todayInput = () => new Date().toISOString().slice(0, 10);

export default function ExpensesView({ initialExpenses }: { initialExpenses: ExpenseItem[] }) {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategoryValue>("CLEANING_SUPPLIES");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput());
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);

  async function submit() {
    if (!amount || !date) return;
    setSaving(true);
    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        vendor: vendor || undefined,
        amount: Math.round(Number(amount) * 100),
        date,
        description: description || undefined,
        paymentMethod: paymentMethod || undefined,
        isTaxDeductible,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) {
      showToast("Couldn't save expense", "error");
      return;
    }
    setExpenses((prev) => [
      { id: json.id, category, vendor: vendor || null, amount: Math.round(Number(amount) * 100), date: new Date(date).toISOString(), description: description || null, paymentMethod: paymentMethod || null, isTaxDeductible, receiptUrl: null },
      ...prev,
    ]);
    setFormOpen(false);
    setVendor("");
    setAmount("");
    setDescription("");
    showToast("Expense recorded", "success");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/expenses/${deleteTarget}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't delete expense", "error");
    } else {
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget));
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Expenses</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{expenses.length} total</p>
        </div>
        <button type="button" onClick={() => setFormOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
          <Plus className="size-4" aria-hidden /> Add expense
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Total expenses</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(total / 100).toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Categories tracked</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{byCategory.size}</p>
        </Card>
      </div>

      {formOpen && (
        <Card className="mt-4">
          <h2 className="font-semibold text-admin-text">Add an expense</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategoryValue)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{expenseCategoryLabels[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Vendor</span>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Amount ($)</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Payment method</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="mt-5 flex items-center gap-2 text-sm text-admin-text">
              <input type="checkbox" checked={isTaxDeductible} onChange={(e) => setIsTaxDeductible(e.target.checked)} /> Tax-deductible
            </label>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="text-xs font-medium text-admin-text-muted">Description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
          </div>
          <button type="button" onClick={submit} disabled={!amount || !date || saving} className="ios-press mt-3 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            Save
          </button>
        </Card>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {expenses.length === 0 ? (
          <EmptyState icon={ReceiptIcon} title="No expenses yet" description="Track cleaning supplies, transportation, equipment, and other business costs here." />
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Date</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Category</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Vendor</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Amount</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Method</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Deductible</th>
                <th scope="col" className="w-10 p-3.5" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-admin-border">
                  <td className="p-3.5 text-admin-text-muted">{formatCalendarDate(e.date)}</td>
                  <td className="p-3.5 text-admin-text">{expenseCategoryLabels[e.category]}</td>
                  <td className="p-3.5 text-admin-text">{e.vendor ?? "—"}</td>
                  <td className="p-3.5 text-admin-text">${(e.amount / 100).toFixed(2)}</td>
                  <td className="p-3.5 capitalize text-admin-text-muted">{e.paymentMethod ?? "—"}</td>
                  <td className="p-3.5">{e.isTaxDeductible ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>}</td>
                  <td className="p-3.5">
                    <button type="button" onClick={() => setDeleteTarget(e.id)} aria-label="Delete expense" className="flex size-8 items-center justify-center rounded-lg text-admin-error hover:bg-red-50">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this expense?"
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
