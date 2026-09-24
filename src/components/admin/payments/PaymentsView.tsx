"use client";

import { useState } from "react";
import { Plus, CreditCard, Loader2, Receipt, ExternalLink } from "lucide-react";
import type { PaymentListItem, PaymentStatusValue } from "@/lib/server/paymentStore";
import { PAYMENT_STATUSES } from "@/lib/server/paymentStore";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate } from "@/lib/adminDate";
import ImageUploadField from "@/components/admin/content/ImageUploadField";
import { PAYMENT_METHODS, paymentMethodLabels, paymentReferenceLabels, labelForMethod, type PaymentMethodValue } from "@/lib/paymentMethods";

export default function PaymentsView({
  payments: initialPayments,
  bookingsAwaitingPayment,
}: {
  payments: PaymentListItem[];
  bookingsAwaitingPayment: { bookingId: string; reference: string; customerName: string }[];
}) {
  const { showToast } = useToast();
  const [payments, setPayments] = useState(initialPayments);
  const [formOpen, setFormOpen] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"deposit" | "full_payment">("full_payment");
  const [status, setStatus] = useState<PaymentStatusValue>("PAID");
  const [proofUrl, setProofUrl] = useState("");
  const [method, setMethod] = useState<PaymentMethodValue>("ZELLE");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachingProofFor, setAttachingProofFor] = useState<string | null>(null);

  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.amount, 0);

  async function submit() {
    if (!bookingId || !amount) return;
    setSaving(true);
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, amount: Math.round(Number(amount) * 100), kind, status, method, reference: reference || undefined, proofUrl: proofUrl || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Couldn't record payment", "error");
      return;
    }
    showToast("Payment recorded", "success");
    setFormOpen(false);
    setBookingId("");
    setAmount("");
    setProofUrl("");
    setReference("");
    window.location.reload();
  }

  async function attachProof(id: string, url: string) {
    const res = await fetch(`/api/admin/payments/${id}/proof`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proofUrl: url }),
    });
    if (!res.ok) {
      showToast("Couldn't attach receipt", "error");
      return;
    }
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, proofUrl: url } : p)));
    setAttachingProofFor(null);
    showToast("Receipt attached", "success");
  }

  async function changeStatus(id: string, next: PaymentStatusValue) {
    const res = await fetch(`/api/admin/payments/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      showToast("Couldn't update payment", "error");
      return;
    }
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
    showToast("Updated", "success");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Payments</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{payments.length} total</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          disabled={bookingsAwaitingPayment.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Record payment
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Received</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(totalPaid / 100).toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Pending</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(totalPending / 100).toLocaleString("en-US")}</p>
        </Card>
      </div>

      {formOpen && (
        <Card className="mt-4">
          <h2 className="font-semibold text-admin-text">Record a payment</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Booking</span>
              <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                <option value="">Select a booking…</option>
                {bookingsAwaitingPayment.map((b) => (
                  <option key={b.bookingId} value={b.bookingId}>{b.reference} — {b.customerName}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Amount ($)</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Kind</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                <option value="full_payment">Full payment</option>
                <option value="deposit">Deposit</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatusValue)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Payment method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodValue)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{paymentMethodLabels[m]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">{paymentReferenceLabels[method]}</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
          </div>
          <div className="mt-3 max-w-sm">
            <ImageUploadField label="Proof of payment (optional — receipt or screenshot)" value={proofUrl} onChange={setProofUrl} />
          </div>
          <button type="button" onClick={submit} disabled={!bookingId || !amount || saving} className="ios-press mt-3 flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save
          </button>
        </Card>
      )}

      <div className="mt-4 admin-table-surface overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            description="Record a payment against a confirmed booking, or connect a payment processor in Settings."
          />
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Customer</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Booking</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Kind</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Method</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Amount</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Date</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Status</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-admin-border">
                  <td className="p-3.5 text-admin-text">{p.customerName}</td>
                  <td className="p-3.5 text-admin-text-muted">{p.bookingReference ?? "—"}</td>
                  <td className="p-3.5 capitalize text-admin-text">{p.kind.replace(/_/g, " ")}</td>
                  <td className="p-3.5 text-admin-text">
                    {labelForMethod(p.method)}
                    {p.reference && <span className="block text-xs text-admin-text-muted">{p.reference}</span>}
                  </td>
                  <td className="p-3.5 text-admin-text">${(p.amount / 100).toFixed(2)}</td>
                  <td className="p-3.5 text-admin-text-muted">{formatDate(p.createdAt)}</td>
                  <td className="p-3.5">
                    <select
                      aria-label="Payment status"
                      value={p.status}
                      onChange={(e) => changeStatus(p.id, e.target.value as PaymentStatusValue)}
                      className="rounded-lg border border-admin-border px-2 py-1 text-xs font-semibold text-admin-text"
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3.5">
                    {p.proofUrl ? (
                      <a
                        href={p.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-admin-teal hover:text-admin-teal-hover"
                      >
                        <Receipt className="size-3.5" aria-hidden /> View <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : attachingProofFor === p.id ? (
                      <div className="w-40">
                        <ImageUploadField label="" value="" onChange={() => {}} onCommit={(url) => attachProof(p.id, url)} />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAttachingProofFor(p.id)}
                        className="text-xs font-semibold text-admin-text-muted hover:text-admin-text"
                      >
                        Attach
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
