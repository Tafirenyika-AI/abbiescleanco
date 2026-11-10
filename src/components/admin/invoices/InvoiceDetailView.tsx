"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Ban, ArrowLeft, Loader2, Mail, CheckCircle2, Link2, Copy, Trash2, DollarSign, X } from "lucide-react";
import { useToast } from "@/components/admin/ui/Toast";
import Badge from "@/components/admin/ui/Badge";
import { invoiceStatusLabels, invoicePaymentLinkStatusLabels, invoicePaymentLinkStatusTone, type InvoiceDetail } from "@/lib/invoices";
import { PAYMENT_METHODS, paymentMethodLabels, paymentReferenceLabels, type PaymentMethodValue } from "@/lib/paymentMethods";
import { GeneratePaymentLinkModal } from "@/components/admin/invoices/InvoicesView";
import type { ContactInfo } from "@/lib/server/siteSettings";
import { formatDate } from "@/lib/adminDate";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusTextClass: Record<string, string> = {
  PAID: "text-green-700",
  PARTIALLY_PAID: "text-amber-600",
  UNPAID: "text-red-700",
  OVERDUE: "text-red-700",
  REFUNDED: "text-blue-700",
  CANCELLED: "text-slate-500",
};

export default function InvoiceDetailView({
  invoice: initialInvoice,
  business,
  contact,
  logoUrl,
}: {
  invoice: InvoiceDetail;
  business: { name: string; legalName: string; city: string; region: string };
  contact: ContactInfo;
  logoUrl: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [voiding, setVoiding] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethodValue>("ZELLE");
  const [payReference, setPayReference] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [voidingLinkId, setVoidingLinkId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function voidThisInvoice() {
    if (!confirm(`Void invoice ${invoice.invoiceNumber}? This can't be undone.`)) return;
    setVoiding(true);
    const res = await fetch(`/api/admin/invoices/${invoice.id}/void`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setVoiding(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't void invoice", "error");
    setInvoice({ ...invoice, status: "CANCELLED" });
    showToast("Invoice voided.", "success");
  }

  async function markPaid() {
    setMarkingPaid(true);
    const res = await fetch(`/api/admin/invoices/${invoice.id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: payMethod, reference: payReference || undefined }),
    });
    const data = await res.json().catch(() => null);
    setMarkingPaid(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't mark invoice paid", "error");
    showToast("Marked as paid.", "success");
    setPayFormOpen(false);
    window.location.reload();
  }

  async function voidLink(id: string) {
    if (!confirm("Cancel this payment link? It will stop accepting payment.")) return;
    setVoidingLinkId(id);
    const res = await fetch(`/api/admin/invoices/payment-links/${id}/void`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setVoidingLinkId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't cancel link", "error");
    setInvoice({ ...invoice, paymentLinks: invoice.paymentLinks.map((l) => (l.id === id ? { ...l, status: "VOID" } : l)) });
    showToast("Payment link cancelled.", "success");
  }

  async function deleteThisInvoice() {
    const warn = invoice.paidAmount > 0 ? ` It has $${(invoice.paidAmount / 100).toFixed(2)} in real recorded payments -- those stay on the books, but this invoice's own record will be gone.` : "";
    if (!confirm(`Permanently delete invoice ${invoice.invoiceNumber}? This can't be undone.${warn}`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/invoices/${invoice.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setDeleting(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't delete invoice", "error");
    showToast("Invoice deleted.", "success");
    router.push("/admin/invoices");
  }

  async function emailInvoice() {
    const verb = invoice.emailedAt ? "Re-send" : "Send";
    if (!confirm(`${verb} invoice ${invoice.invoiceNumber} to ${invoice.customerEmail || "the customer"} now? This sends a real email.`)) return;
    setEmailing(true);
    const res = await fetch(`/api/admin/invoices/${invoice.id}/send`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setEmailing(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't send invoice email", "error");
    setInvoice({ ...invoice, emailedAt: new Date().toISOString() });
    showToast("Invoice emailed to customer.", "success");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/invoices" className="ios-press inline-flex items-center gap-1.5 text-sm font-medium text-admin-text-muted hover:text-admin-text">
          <ArrowLeft className="size-4" aria-hidden /> Back to invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {invoice.emailedAt && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-admin-text-muted">
              <CheckCircle2 className="size-3.5 text-green-600" aria-hidden /> Emailed {formatDate(invoice.emailedAt)}
            </span>
          )}
          {invoice.status !== "CANCELLED" && (
            <button type="button" onClick={emailInvoice} disabled={emailing} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {emailing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />} {invoice.emailedAt ? "Re-send" : "Email to customer"}
            </button>
          )}
          {invoice.status !== "CANCELLED" && invoice.balance > 0 && invoice.bookingId && (
            <button type="button" onClick={() => setLinkModalOpen(true)} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-bg px-4 py-2 text-sm font-semibold text-admin-text">
              <Link2 className="size-4" aria-hidden /> Get payment link
            </button>
          )}
          {invoice.status !== "CANCELLED" && invoice.balance > 0 && invoice.bookingId && (
            <button type="button" onClick={() => setPayFormOpen((v) => !v)} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-bg px-4 py-2 text-sm font-semibold text-admin-text">
              <DollarSign className="size-4" aria-hidden /> Mark as paid
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-bg px-4 py-2 text-sm font-semibold text-admin-text">
            <Printer className="size-4" aria-hidden /> Print / Save PDF
          </button>
          {invoice.status !== "CANCELLED" && (
            <button type="button" onClick={voidThisInvoice} disabled={voiding} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
              {voiding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" aria-hidden />} Void
            </button>
          )}
          <button type="button" onClick={deleteThisInvoice} disabled={deleting} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
            {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Delete
          </button>
        </div>
      </div>

      {payFormOpen && (
        <div className="print:hidden mx-auto max-w-2xl rounded-xl border border-admin-border bg-admin-card p-4">
          <h3 className="text-sm font-semibold text-admin-text">Mark as paid, ${(invoice.balance / 100).toFixed(2)} outstanding</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Payment method</span>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethodValue)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{paymentMethodLabels[m]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">{paymentReferenceLabels[payMethod]}</span>
              <input value={payReference} onChange={(e) => setPayReference(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
          </div>
          <button type="button" onClick={markPaid} disabled={markingPaid} className="ios-press mt-3 flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {markingPaid && <Loader2 className="size-4 animate-spin" aria-hidden />} Record full payment
          </button>
        </div>
      )}

      {invoice.paymentLinks.length > 0 && (
        <div className="print:hidden mx-auto max-w-2xl rounded-xl border border-admin-border bg-admin-card p-4">
          <h3 className="text-sm font-semibold text-admin-text">Payment links</h3>
          <ul className="mt-2 space-y-2">
            {invoice.paymentLinks.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 rounded-lg border border-admin-border px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={invoicePaymentLinkStatusTone[link.status]}>{invoicePaymentLinkStatusLabels[link.status]}</Badge>
                    <span className="text-sm text-admin-text">${(link.amount / 100).toFixed(2)}</span>
                    {link.invoiceNumbers.length > 1 && <span className="text-xs text-admin-text-muted">({link.invoiceNumbers.join(", ")})</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-admin-text-muted">{link.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => navigator.clipboard.writeText(link.url)} title="Copy link" className="ios-press rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg">
                    <Copy className="size-4" aria-hidden />
                  </button>
                  {link.status === "PENDING" && (
                    <button type="button" onClick={() => voidLink(link.id)} disabled={voidingLinkId === link.id} className="ios-press rounded-md p-1.5 text-red-700 hover:bg-red-50">
                      {voidingLinkId === link.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {linkModalOpen && <GeneratePaymentLinkModal invoices={[invoice]} onClose={() => setLinkModalOpen(false)} onDone={() => window.location.reload()} />}

      <div id="printable-area" className="ios-card-shadow mx-auto max-w-2xl rounded-2xl border border-admin-border bg-white p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={business.name} className="h-12 w-12 shrink-0 rounded-lg object-contain" />
            <div>
              <h1 className="text-xl font-bold text-navy-950">{business.legalName}</h1>
              <p className="text-sm text-surface-700">{business.city}, {business.region}</p>
              <p className="text-sm text-surface-700">{contact.phoneDisplay} · {contact.email}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase tracking-wide text-navy-950">Invoice</h2>
            <p className="mt-1 text-sm text-surface-700">{invoice.invoiceNumber}</p>
            <p className={`mt-1 text-lg font-bold uppercase tracking-wide ${statusTextClass[invoice.status] ?? "text-slate-500"}`}>
              {invoiceStatusLabels[invoice.status]}
            </p>
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
            {invoice.serviceDate && <p><span className="text-surface-700">Service date: </span><span className="font-medium text-navy-950">{formatDate(invoice.serviceDate)}</span></p>}
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
          {invoice.tipAmount > 0 && <div className="flex justify-between"><span className="text-surface-700">Tip</span><span className="text-navy-950">{money(invoice.tipAmount)}</span></div>}
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
