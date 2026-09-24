"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Ban, ArrowLeft, Loader2 } from "lucide-react";
import Badge from "@/components/admin/ui/Badge";
import { useToast } from "@/components/admin/ui/Toast";
import type { InvoiceDetail } from "@/lib/invoices";
import type { ContactInfo } from "@/lib/server/siteSettings";
import { formatDate } from "@/lib/adminDate";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoiceDetailView({
  invoice: initialInvoice,
  business,
  contact,
}: {
  invoice: InvoiceDetail;
  business: { name: string; legalName: string; city: string; region: string };
  contact: ContactInfo;
}) {
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [voiding, setVoiding] = useState(false);

  async function voidThisInvoice() {
    if (!confirm(`Void invoice ${invoice.invoiceNumber}? This can't be undone.`)) return;
    setVoiding(true);
    const res = await fetch(`/api/admin/invoices/${invoice.id}/void`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setVoiding(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't void invoice", "error");
    setInvoice({ ...invoice, status: "VOID" });
    showToast("Invoice voided.", "success");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/invoices" className="ios-press inline-flex items-center gap-1.5 text-sm font-medium text-admin-text-muted hover:text-admin-text">
          <ArrowLeft className="size-4" aria-hidden /> Back to invoices
        </Link>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-bg px-4 py-2 text-sm font-semibold text-admin-text">
            <Printer className="size-4" aria-hidden /> Print / Save PDF
          </button>
          {invoice.status !== "VOID" && (
            <button type="button" onClick={voidThisInvoice} disabled={voiding} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
              {voiding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" aria-hidden />} Void
            </button>
          )}
        </div>
      </div>

      <div id="printable-area" className="ios-card-shadow mx-auto max-w-2xl rounded-2xl border border-admin-border bg-white p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-navy-950">{business.legalName}</h1>
            <p className="text-sm text-surface-700">{business.city}, {business.region}</p>
            <p className="text-sm text-surface-700">{contact.phoneDisplay} · {contact.email}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase tracking-wide text-navy-950">Invoice</h2>
            <p className="mt-1 text-sm text-surface-700">{invoice.invoiceNumber}</p>
            {invoice.status === "VOID" && <Badge tone="error" className="mt-1">VOID</Badge>}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-surface-700">Bill to</p>
            <p className="mt-1 font-medium text-navy-950">{invoice.customerName}</p>
            {invoice.billingAddress && <p className="text-surface-700">{invoice.billingAddress}</p>}
            <p className="text-surface-700">{invoice.customerEmail}</p>
            <p className="text-surface-700">{invoice.customerPhone}</p>
          </div>
          <div className="text-right">
            <p><span className="text-surface-700">Issue date: </span><span className="font-medium text-navy-950">{formatDate(invoice.issueDate)}</span></p>
            {invoice.dueDate && <p><span className="text-surface-700">Due date: </span><span className="font-medium text-navy-950">{formatDate(invoice.dueDate)}</span></p>}
            <p><span className="text-surface-700">Quote: </span><span className="font-medium text-navy-950">{invoice.quoteNumber}</span></p>
            {invoice.bookingReference && <p><span className="text-surface-700">Booking: </span><span className="font-medium text-navy-950">{invoice.bookingReference}</span></p>}
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs font-semibold uppercase text-surface-700">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-surface-100">
                <td className="py-2 text-navy-950">{item.label}</td>
                <td className="py-2 text-right text-navy-950">{item.quantity}</td>
                <td className="py-2 text-right text-navy-950">{money(item.unitPrice)}</td>
                <td className="py-2 text-right text-navy-950">{money(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-surface-700">Subtotal</span><span className="text-navy-950">{money(invoice.subtotal)}</span></div>
          {invoice.discount > 0 && <div className="flex justify-between"><span className="text-surface-700">Discount</span><span className="text-navy-950">−{money(invoice.discount)}</span></div>}
          {invoice.tax > 0 && <div className="flex justify-between"><span className="text-surface-700">Tax</span><span className="text-navy-950">{money(invoice.tax)}</span></div>}
          <div className="flex justify-between border-t border-surface-200 pt-1 text-base font-semibold"><span className="text-navy-950">Total</span><span className="text-navy-950">{money(invoice.total)}</span></div>
          <div className="flex justify-between"><span className="text-surface-700">Paid</span><span className="text-navy-950">{money(invoice.paidAmount)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span className="text-navy-950">Balance due</span><span className="text-navy-950">{money(invoice.balance)}</span></div>
        </div>

        {invoice.payments.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase text-surface-700">Payments</p>
            <ul className="mt-1 space-y-0.5 text-sm text-navy-950">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{formatDate(p.createdAt)}, {p.method || "—"}, {p.status}</span>
                  <span>{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {invoice.notes && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase text-surface-700">Notes</p>
            <p className="mt-1 text-sm text-navy-950">{invoice.notes}</p>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-surface-700">Thank you for choosing {business.name}.</p>
      </div>
    </div>
  );
}
