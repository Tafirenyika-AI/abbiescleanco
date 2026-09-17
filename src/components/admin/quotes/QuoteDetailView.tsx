"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Send, Copy, MessageCircle, CalendarPlus, Tag } from "lucide-react";
import type { QuoteDetail, QuoteStatusValue } from "@/lib/server/quoteStore";
import type { PromoCodeItem } from "@/lib/server/promoCodeStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDateTime } from "@/lib/adminDate";

interface LineItem {
  label: string;
  quantity: number;
  unitPrice: number; // dollars, for display; converted to cents on save
}

const statusTone: Record<QuoteStatusValue, "neutral" | "info" | "success" | "error" | "warning"> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "error",
  EXPIRED: "warning",
};

export default function QuoteDetailView({
  mode,
  leadId,
  leadReference,
  customerName,
  customerPhone,
  serviceName,
  quote,
  suggestedUnitPrice,
  leadPromoCode,
}: {
  mode: "create" | "edit";
  leadId: string;
  leadReference: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  quote: QuoteDetail | null;
  suggestedUnitPrice?: number; // cents
  leadPromoCode?: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const isDraft = mode === "create" || quote?.status === "DRAFT";

  const [items, setItems] = useState<LineItem[]>(
    quote
      ? quote.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice / 100 }))
      : [{ label: serviceName, quantity: 1, unitPrice: suggestedUnitPrice ? suggestedUnitPrice / 100 : 0 }]
  );
  const [discount, setDiscount] = useState(quote ? quote.discount / 100 : 0);
  const [tax, setTax] = useState(quote ? quote.tax / 100 : 0);
  const [deposit, setDeposit] = useState(quote ? quote.deposit / 100 : 0);
  const [expiresAt, setExpiresAt] = useState(quote?.expiresAt ? quote.expiresAt.slice(0, 10) : "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingStart, setBookingStart] = useState("09:00");
  const [bookingEnd, setBookingEnd] = useState("11:00");
  const [bookingArrivalWindow, setBookingArrivalWindow] = useState("");
  const [bookingStaff, setBookingStaff] = useState("");
  const [bookingConflicts, setBookingConflicts] = useState<{ reference: string; customerName: string; scheduledStart: string | null }[] | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [validPromo, setValidPromo] = useState<PromoCodeItem | null>(null);
  const [promoApplied, setPromoApplied] = useState(false);

  useEffect(() => {
    if (mode !== "create" || !leadPromoCode) return;
    let cancelled = false;
    fetch(`/api/admin/promo-codes/validate?code=${encodeURIComponent(leadPromoCode)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.ok && json.valid) setValidPromo(json.promo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, leadPromoCode]);

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal - discount + tax);

  function applyPromo() {
    if (!validPromo) return;
    const discountDollars =
      validPromo.discountType === "PERCENT" ? (subtotal / 100) * (validPromo.discountValue / 100) : validPromo.discountValue / 100;
    setDiscount(Math.round(discountDollars * 100) / 100);
    setPromoApplied(true);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { label: "", quantity: 1, unitPrice: 0 }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function payload() {
    return {
      items: items.filter((i) => i.label.trim()).map((i) => ({ label: i.label.trim(), quantity: i.quantity, unitPrice: Math.round(i.unitPrice * 100) })),
      discount: Math.round(discount * 100),
      tax: Math.round(tax * 100),
      deposit: Math.round(deposit * 100),
      expiresAt: expiresAt || undefined,
      notes: notes || undefined,
      promoCodeId: mode === "create" && promoApplied && validPromo ? validPromo.id : undefined,
    };
  }

  async function save() {
    if (items.filter((i) => i.label.trim()).length === 0) {
      showToast("Add at least one line item", "error");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, ...payload() }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          showToast(json.error || "Couldn't create quote", "error");
          return;
        }
        showToast("Quote saved", "success");
        router.push(`/admin/quotes/${json.id}`);
      } else if (quote) {
        const res = await fetch(`/api/admin/quotes/${quote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          showToast(json.error || "Couldn't save quote", "error");
          return;
        }
        showToast("Quote saved", "success");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote() {
    if (mode === "create") {
      showToast("Save the quote first", "error");
      return;
    }
    if (!quote) return;
    setSending(true);
    try {
      // Save any pending edits first so what's sent matches what's on screen.
      const saveRes = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!saveRes.ok) {
        showToast("Couldn't save before sending", "error");
        return;
      }
      const res = await fetch(`/api/admin/quotes/${quote.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(json.error || "Couldn't send quote", "error");
        return;
      }
      showToast(json.mode === "mock" ? "Quote marked sent (no email provider configured — see Settings)" : "Quote emailed to customer", "success");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: QuoteStatusValue) {
    if (!quote) return;
    const res = await fetch(`/api/admin/quotes/${quote.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      showToast("Couldn't update status", "error");
      return;
    }
    showToast(`Marked ${status.toLowerCase()}`, "success");
    router.refresh();
  }

  async function duplicate() {
    if (!quote) return;
    const res = await fetch(`/api/admin/quotes/${quote.id}/duplicate`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      showToast("Couldn't duplicate quote", "error");
      return;
    }
    router.push(`/admin/quotes/${json.id}`);
  }

  async function createBooking(confirmDespiteConflict = false) {
    if (!quote || !bookingDate) return;
    setCreatingBooking(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          scheduledStart: `${bookingDate}T${bookingStart}:00`,
          scheduledEnd: `${bookingDate}T${bookingEnd}:00`,
          arrivalWindow: bookingArrivalWindow || undefined,
          staffAssignee: bookingStaff || undefined,
          confirmDespiteConflict,
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setBookingConflicts(json.conflicts);
        return;
      }
      if (!res.ok || !json.ok) {
        showToast(json.error || "Couldn't create booking", "error");
        return;
      }
      showToast("Booking created", "success");
      router.push(`/admin/bookings/${json.id}`);
    } finally {
      setCreatingBooking(false);
    }
  }

  async function confirmDeleteQuote() {
    if (!quote) return;
    const res = await fetch(`/api/admin/quotes/${quote.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    if (!res.ok) {
      showToast("Couldn't delete quote", "error");
      return;
    }
    router.push("/admin/quotes");
  }

  const waNumber = customerPhone.replace(/[^\d]/g, "");
  const waText = encodeURIComponent(`Hi ${customerName.split(" ")[0] || ""}, here's your quote${quote ? ` (${quote.quoteNumber})` : ""} from Abbie's Clean Method: $${total.toFixed(2)} total.`);

  return (
    <div>
      <Link href="/admin/quotes" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to quotes
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">
            {quote ? quote.quoteNumber : "New quote"}
          </h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            {customerName} · {serviceName} · from lead <Link href="/admin/leads" className="text-admin-teal-hover hover:underline">{leadReference}</Link>
          </p>
        </div>
        {quote && <Badge tone={statusTone[quote.status]}>{quote.status}</Badge>}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="font-semibold text-admin-text">Line items</h2>
            <div className="mt-3 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={item.label}
                    onChange={(e) => updateItem(i, { label: e.target.value })}
                    disabled={!isDraft}
                    placeholder="Description"
                    className="min-w-[160px] flex-1 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg disabled:opacity-70"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    disabled={!isDraft}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                    className="w-16 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg disabled:opacity-70"
                    aria-label="Quantity"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-admin-text-muted">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      disabled={!isDraft}
                      onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                      className="w-24 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg disabled:opacity-70"
                      aria-label="Unit price"
                    />
                  </div>
                  <span className="w-20 text-right text-sm font-medium text-admin-text">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                  {isDraft && (
                    <button type="button" onClick={() => removeItem(i)} aria-label="Remove item" className="flex size-8 items-center justify-center rounded-lg text-admin-text-muted hover:bg-red-50 hover:text-admin-error">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isDraft && (
              <button type="button" onClick={addItem} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg">
                <Plus className="size-3.5" aria-hidden /> Add line item
              </button>
            )}

            {validPromo && !promoApplied && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-admin-teal/10 p-3">
                <p className="flex items-center gap-2 text-sm text-admin-text">
                  <Tag className="size-4 text-admin-teal" aria-hidden />
                  Customer entered promo code <strong className="font-mono">{validPromo.code}</strong> —{" "}
                  {validPromo.discountType === "PERCENT" ? `${validPromo.discountValue}% off` : `$${(validPromo.discountValue / 100).toFixed(2)} off`}
                </p>
                <button type="button" onClick={applyPromo} className="rounded-full bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover">
                  Apply to discount
                </button>
              </div>
            )}
            {promoApplied && validPromo && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-admin-success">
                <Tag className="size-4" aria-hidden /> Promo code {validPromo.code} applied
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Discount ($)</span>
                <input type="number" min={0} step="0.01" value={discount} disabled={!isDraft} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Tax ($)</span>
                <input type="number" min={0} step="0.01" value={tax} disabled={!isDraft} onChange={(e) => setTax(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Deposit required ($)</span>
                <input type="number" min={0} step="0.01" value={deposit} disabled={!isDraft} onChange={(e) => setDeposit(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Expires</span>
                <input type="date" value={expiresAt} disabled={!isDraft} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="text-xs font-medium text-admin-text-muted">Internal notes / terms</span>
              <textarea value={notes} disabled={!isDraft} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
            </label>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-admin-text">Total</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-admin-text-muted">Subtotal</dt><dd className="text-admin-text">${subtotal.toFixed(2)}</dd></div>
              {discount > 0 && <div className="flex justify-between"><dt className="text-admin-text-muted">Discount</dt><dd className="text-admin-text">-${discount.toFixed(2)}</dd></div>}
              {tax > 0 && <div className="flex justify-between"><dt className="text-admin-text-muted">Tax</dt><dd className="text-admin-text">${tax.toFixed(2)}</dd></div>}
              <div className="flex justify-between border-t border-admin-border pt-1.5 font-semibold"><dt className="text-admin-text">Total</dt><dd className="text-admin-text">${total.toFixed(2)}</dd></div>
              {deposit > 0 && <div className="flex justify-between"><dt className="text-admin-text-muted">Deposit due</dt><dd className="text-admin-text">${deposit.toFixed(2)}</dd></div>}
            </dl>

            {isDraft && (
              <button type="button" onClick={save} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {mode === "create" ? "Save draft" : "Save changes"}
              </button>
            )}

            {mode === "edit" && quote?.status === "DRAFT" && (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Optional message to include in the email…"
                  className="mt-3 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                />
                <button type="button" onClick={sendQuote} disabled={sending} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-admin-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                  {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                  Send by email
                </button>
              </>
            )}

            {quote && waNumber && (
              <a href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noreferrer" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-admin-border px-4 py-2.5 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                <MessageCircle className="size-4" aria-hidden /> Send via WhatsApp
              </a>
            )}
          </Card>

          {quote && (
            <Card>
              <h2 className="font-semibold text-admin-text">Actions</h2>
              <div className="mt-3 flex flex-col gap-2">
                {quote.status === "SENT" && (
                  <>
                    <button type="button" onClick={() => setStatus("ACCEPTED")} className="rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">Mark accepted</button>
                    <button type="button" onClick={() => setStatus("DECLINED")} className="rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">Mark declined</button>
                  </>
                )}
                <button type="button" onClick={duplicate} className="flex items-center justify-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
                  <Copy className="size-3.5" aria-hidden /> Duplicate as new draft
                </button>
                {quote.status === "ACCEPTED" ? (
                  <button type="button" onClick={() => setBookingDialog(true)} className="flex items-center justify-center gap-1.5 rounded-lg bg-admin-teal px-3 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
                    <CalendarPlus className="size-3.5" aria-hidden /> Convert to booking
                  </button>
                ) : (
                  <span title="Only accepted quotes can become bookings" className="cursor-not-allowed rounded-lg border border-dashed border-admin-border px-3 py-2 text-center text-sm text-admin-text-muted">
                    Convert to booking
                  </span>
                )}
                <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-admin-error/30 px-3 py-2 text-sm font-semibold text-admin-error hover:bg-red-50">
                  Delete quote
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this quote?"
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDeleteQuote}
        onCancel={() => setConfirmDelete(false)}
      />

      {bookingDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-admin-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-admin-text">Schedule this cleaning</h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Date</span>
                <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Start</span>
                  <input type="time" value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">End</span>
                  <input type="time" value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Arrival window (optional)</span>
                <input value={bookingArrivalWindow} onChange={(e) => setBookingArrivalWindow(e.target.value)} placeholder="e.g. 9–11am" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Assigned cleaner (optional)</span>
                <input value={bookingStaff} onChange={(e) => setBookingStaff(e.target.value)} placeholder="Name" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
            </div>

            {bookingConflicts && (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">This overlaps with:</p>
                <ul className="mt-1 list-disc pl-4">
                  {bookingConflicts.map((c) => (
                    <li key={c.reference}>{c.customerName} — {c.scheduledStart ? formatDateTime(c.scheduledStart) : ""}</li>
                  ))}
                </ul>
                <button type="button" onClick={() => createBooking(true)} disabled={creatingBooking} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                  Schedule anyway
                </button>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setBookingDialog(false); setBookingConflicts(null); }} className="rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                Cancel
              </button>
              <button
                type="button"
                disabled={!bookingDate || creatingBooking}
                onClick={() => createBooking(false)}
                className="flex items-center gap-2 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
              >
                {creatingBooking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Create booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
