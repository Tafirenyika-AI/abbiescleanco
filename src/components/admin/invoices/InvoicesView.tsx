"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, FileStack } from "lucide-react";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import { type InvoiceListItem, type InvoiceableQuote, invoiceStatusLabels, invoiceStatusTone } from "@/lib/invoices";
import { formatDate } from "@/lib/adminDate";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoicesView({ invoices }: { invoices: InvoiceListItem[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">Invoices</h1>
          <p className="mt-1 text-sm text-admin-text-muted">Formal, printable bills issued against accepted quotes.</p>
        </div>
        <button type="button" onClick={() => setPickerOpen(true)} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,157,138,0.25),0_6px_16px_rgba(15,157,138,0.22)]">
          <Plus className="size-4" aria-hidden /> New invoice
        </button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileStack} title="No invoices yet" description="Issue an invoice from any accepted quote." />
      ) : (
        <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
          <table className="w-full text-sm">
            <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
              <tr>
                <th className="px-4 py-2.5">Invoice #</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Issued</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Balance</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-admin-border transition-colors duration-150 hover:bg-admin-bg">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/invoices/${inv.id}`} className="font-medium text-admin-teal-hover hover:underline">{inv.invoiceNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-admin-text">{inv.customerName}</td>
                  <td className="px-4 py-2.5 text-admin-text-muted">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-2.5 text-admin-text">{money(inv.total)}</td>
                  <td className="px-4 py-2.5 text-admin-text-muted">
                    {inv.status === "CANCELLED" || inv.balance <= 0 ? "—" : `${money(inv.balance)} due`}
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={invoiceStatusTone[inv.status]}>{invoiceStatusLabels[inv.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pickerOpen && <NewInvoicePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function NewInvoicePicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [quotes, setQuotes] = useState<InvoiceableQuote[] | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/invoices/invoiceable-quotes")
      .then((r) => r.json())
      .then((data) => setQuotes(data.ok ? data.quotes : []));
  }, []);

  async function create(quote: InvoiceableQuote) {
    setCreating(quote.id);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: quote.id, bookingId: quote.bookingId || undefined }),
    });
    const data = await res.json().catch(() => null);
    setCreating(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't create invoice", "error");
    router.push(`/admin/invoices/${data.id}`);
  }

  return (
    <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-modal-in max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-admin-text">New invoice</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ios-press rounded-lg p-1.5 text-admin-text-muted hover:bg-admin-bg"><X className="size-5" aria-hidden /></button>
        </div>
        <p className="mt-1 text-sm text-admin-text-muted">Pick an accepted quote that hasn&apos;t been invoiced yet.</p>

        {quotes === null && <p className="mt-4 flex items-center gap-2 text-sm text-admin-text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading…</p>}
        {quotes?.length === 0 && <p className="mt-4 text-sm text-admin-text-muted">No accepted quotes are waiting to be invoiced.</p>}
        {quotes && quotes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between rounded-lg border border-admin-border px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium text-admin-text">{q.quoteNumber}, {q.customerName}</p>
                  <p className="text-xs text-admin-text-muted">{money(q.total)}{q.bookingReference ? ` · ${q.bookingReference}` : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => create(q)}
                  disabled={creating === q.id}
                  className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {creating === q.id && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Invoice
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
