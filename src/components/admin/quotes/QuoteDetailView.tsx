"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Send, Copy, MessageCircle, CalendarPlus, Tag, Eye, GitBranch, Lock, Ban, X, Printer } from "lucide-react";
import type { QuoteDetail, QuoteStatusValue } from "@/lib/server/quoteStore";
import type { PromoCodeItem } from "@/lib/server/promoCodeStore";
import type { ContactInfo } from "@/lib/server/siteSettings";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import SegmentedControl from "@/components/admin/ui/SegmentedControl";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDateTime } from "@/lib/adminDate";
import CustomerQuoteView from "@/components/quotes/CustomerQuoteView";
import {
  PRICING_UNITS, pricingUnitLabels, FREQUENCIES, frequencyLabels,
  formatQuotedRate, formatFrequency, estimateInternalMonthlyValueCents, computeQuoteTotals,
} from "@/lib/quotePricing";
import { SCOPE_TEMPLATES } from "@/lib/quoteScopeTemplates";

interface LineItem {
  label: string;
  quantity: number;
  unitPrice: number; // dollars, for display; converted to cents on save
  pricingUnit: string; // "" = plain generic line item
  frequency: string;
  customFrequency: string;
}

const statusTone: Record<QuoteStatusValue, "neutral" | "info" | "success" | "error" | "warning"> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "error",
  EXPIRED: "warning",
  CANCELLED: "error",
};

const EXPIRY_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function itemFromDetail(i: { label: string; quantity: number; unitPrice: number; pricingUnit: string | null; frequency: string | null; customFrequency: string | null }): LineItem {
  return { label: i.label, quantity: i.quantity, unitPrice: i.unitPrice / 100, pricingUnit: i.pricingUnit ?? "", frequency: i.frequency ?? "", customFrequency: i.customFrequency ?? "" };
}

export default function QuoteDetailView({
  mode,
  leadId,
  leadReference,
  customerName,
  customerEmail,
  customerPhone,
  companyName,
  serviceAddress,
  serviceName,
  approxSquareFeet,
  quote,
  suggestedUnitPrice,
  leadPromoCode,
  business,
  contact,
  logoUrl,
}: {
  mode: "create" | "edit";
  leadId: string;
  leadReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName: string | null;
  serviceAddress: string | null;
  serviceName: string;
  approxSquareFeet: number | null;
  quote: QuoteDetail | null;
  suggestedUnitPrice?: number; // cents
  leadPromoCode?: string | null;
  business: { name: string; legalName: string; city: string; region: string };
  contact: ContactInfo;
  logoUrl: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const isDraft = mode === "create" || quote?.status === "DRAFT";

  const [items, setItems] = useState<LineItem[]>(
    quote
      ? quote.items.map(itemFromDetail)
      : [{ label: serviceName, quantity: 1, unitPrice: suggestedUnitPrice ? suggestedUnitPrice / 100 : 0, pricingUnit: "PER_VISIT", frequency: "", customFrequency: "" }]
  );
  const [discountType, setDiscountType] = useState(quote?.discountType ?? "FIXED");
  const [discountValue, setDiscountValue] = useState(quote ? (quote.discountType === "PERCENT" ? quote.discountValue : quote.discountValue / 100) : 0);
  const [tax, setTax] = useState(quote ? quote.tax / 100 : 0);
  const [depositType, setDepositType] = useState(quote?.depositType ?? "NONE");
  const [depositValue, setDepositValue] = useState(quote ? (quote.depositType === "PERCENT" ? quote.depositValue : quote.depositValue / 100) : 0);
  const [expiresAt, setExpiresAt] = useState(quote?.expiresAt ? quote.expiresAt.slice(0, 10) : "");
  const [notes, setNotes] = useState(quote?.notes ?? ""); // Customer Notes / Terms
  const [internalNotes, setInternalNotes] = useState(quote?.internalNotes ?? "");
  const [scopeOfService, setScopeOfService] = useState(quote?.scopeOfService ?? "");
  const [exclusions, setExclusions] = useState(quote?.exclusions ?? "");
  const [customerMessage, setCustomerMessage] = useState(quote?.customerMessage ?? "Thank you for the opportunity to provide this quotation. Abbie's Clean Method LLC looks forward to providing consistent, dependable, and professional cleaning services for your facility.");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // The preview is portaled to document.body (see below) so it can print cleanly without the admin
  // page's own layout height generating trailing blank PDF pages -- this class, scoped to while the
  // modal is actually open, is what lets the print stylesheet collapse the admin shell out of the
  // way (see globals.css's "printing-portal-only" rule).
  useEffect(() => {
    if (!previewOpen) return;
    document.body.classList.add("printing-portal-only");
    return () => document.body.classList.remove("printing-portal-only");
  }, [previewOpen]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [revising, setRevising] = useState(false);
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

  const totalsInput = {
    items: items.filter((i) => i.label.trim()).map((i) => ({ quantity: i.quantity, unitPrice: Math.round(i.unitPrice * 100) })),
    discountType,
    discountValue: discountType === "PERCENT" ? discountValue : Math.round(discountValue * 100),
    tax: Math.round(tax * 100),
    depositType,
    depositValue: depositType === "PERCENT" ? depositValue : Math.round(depositValue * 100),
  };
  const { discount, deposit, total } = computeQuoteTotals(totalsInput);
  const serviceItems = items.filter((i) => i.label.trim() && i.pricingUnit);
  const plainItems = items.filter((i) => i.label.trim() && !i.pricingUnit);
  const hasServiceLine = serviceItems.length > 0;
  const internalMonthlyEstimates = serviceItems
    .map((i) => ({ label: i.label, value: estimateInternalMonthlyValueCents(Math.round(i.unitPrice * 100), i.pricingUnit, i.frequency) }))
    .filter((e): e is { label: string; value: number } => e.value !== null);

  function applyPromo() {
    if (!validPromo) return;
    if (validPromo.discountType === "PERCENT") {
      setDiscountType("PERCENT");
      setDiscountValue(validPromo.discountValue);
    } else {
      setDiscountType("FIXED");
      setDiscountValue(validPromo.discountValue / 100);
    }
    setPromoApplied(true);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addServiceItem() {
    setItems((prev) => [...prev, { label: "", quantity: 1, unitPrice: 0, pricingUnit: "PER_VISIT", frequency: "", customFrequency: "" }]);
  }
  function addPlainItem() {
    setItems((prev) => [...prev, { label: "", quantity: 1, unitPrice: 0, pricingUnit: "", frequency: "", customFrequency: "" }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  // Primary/secondary grouping is purely a RENDER-time split by index -- the underlying `items`
  // array stays one flat list (unchanged save/load shape), so this never risks the index-based
  // updateItem/removeItem calls drifting from what's actually stored.
  const serviceRowIndices = items.map((_, idx) => idx).filter((idx) => items[idx].pricingUnit);
  const plainRowIndices = items.map((_, idx) => idx).filter((idx) => !items[idx].pricingUnit);

  function renderItemRow(i: number) {
    const item = items[i];
    return (
      <div key={i} className="rounded-xl border border-admin-border p-3">
        <div className="flex items-start gap-2">
          <label className="min-w-[160px] flex-1 block">
            <span className="text-xs font-medium text-admin-text-muted">Service</span>
            <input
              value={item.label}
              onChange={(e) => updateItem(i, { label: e.target.value })}
              disabled={!isDraft}
              placeholder={item.pricingUnit ? "e.g. Commercial Cleaning" : "Description"}
              className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg disabled:opacity-70"
            />
          </label>
          {isDraft && (
            <button type="button" onClick={() => removeItem(i)} aria-label="Remove item" className="mt-5 flex size-8 shrink-0 items-center justify-center rounded-lg text-admin-text-muted hover:bg-red-50 hover:text-admin-error">
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {item.pricingUnit ? (
          <div className="mt-3 space-y-3">
            <SegmentedControl
              label="Pricing Unit"
              value={item.pricingUnit}
              disabled={!isDraft}
              onChange={(v) => updateItem(i, { pricingUnit: v })}
              options={PRICING_UNITS.map((u) => ({ value: u, label: pricingUnitLabels[u] }))}
            />
            <SegmentedControl
              label="Frequency"
              value={item.frequency}
              disabled={!isDraft}
              onChange={(v) => updateItem(i, { frequency: v })}
              options={FREQUENCIES.map((f) => ({ value: f, label: frequencyLabels[f] }))}
            />
            {item.frequency === "CUSTOM" && (
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Describe the custom frequency</span>
                <input value={item.customFrequency} disabled={!isDraft} onChange={(e) => updateItem(i, { customFrequency: e.target.value })} placeholder="e.g. Every other Tuesday" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </label>
            )}
            <label className="block max-w-[160px]">
              <span className="text-xs font-medium text-admin-text-muted">Rate</span>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-sm text-admin-text-muted">$</span>
                <input type="number" min={0} step="0.01" value={item.unitPrice} disabled={!isDraft} onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </div>
            </label>
            {item.unitPrice > 0 && (
              <p className="text-sm font-semibold text-admin-teal-hover">{formatQuotedRate(Math.round(item.unitPrice * 100), item.pricingUnit)}</p>
            )}
            {isDraft && (
              <button type="button" onClick={() => updateItem(i, { pricingUnit: "", frequency: "", customFrequency: "" })} className="block text-left text-xs text-admin-text-muted hover:underline">
                Switch to a simple line item (quantity × price) instead
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
            <span className="text-sm font-medium text-admin-text">${(item.quantity * item.unitPrice).toFixed(2)}</span>
            {isDraft && (
              <button type="button" onClick={() => updateItem(i, { pricingUnit: "PER_VISIT" })} className="text-xs text-admin-text-muted hover:underline">
                Switch to service pricing (unit + frequency)
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  function setExpiryPreset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setExpiresAt(toDateInputValue(d));
  }
  function applyScopeTemplate(key: string) {
    if (!key) return;
    const template = SCOPE_TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    if (scopeOfService.trim() && scopeOfService.trim() !== template.text.trim()) {
      if (!window.confirm("Replace the current Scope of Service text with this template? This can be edited afterward.")) return;
    }
    setScopeOfService(template.text);
  }

  function payload() {
    return {
      items: items.filter((i) => i.label.trim()).map((i) => ({
        label: i.label.trim(),
        quantity: i.pricingUnit ? 1 : i.quantity,
        unitPrice: Math.round(i.unitPrice * 100),
        pricingUnit: i.pricingUnit || undefined,
        frequency: i.frequency || undefined,
        customFrequency: i.frequency === "CUSTOM" ? i.customFrequency.trim() || undefined : undefined,
      })),
      discountType,
      discountValue: discountType === "PERCENT" ? Math.round(discountValue) : Math.round(discountValue * 100),
      tax: Math.round(tax * 100),
      depositType,
      depositValue: depositType === "PERCENT" ? Math.round(depositValue) : Math.round(depositValue * 100),
      expiresAt: expiresAt || undefined,
      notes: notes || undefined,
      internalNotes: internalNotes || undefined,
      scopeOfService: scopeOfService || undefined,
      exclusions: exclusions || undefined,
      customerMessage: customerMessage || undefined,
      promoCodeId: mode === "create" && promoApplied && validPromo ? validPromo.id : undefined,
    };
  }

  async function save(): Promise<boolean> {
    if (items.filter((i) => i.label.trim()).length === 0) {
      showToast("Add at least one line item", "error");
      return false;
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
          return false;
        }
        showToast("Quote saved", "success");
        router.push(`/admin/quotes/${json.id}`);
        return true;
      } else if (quote) {
        const res = await fetch(`/api/admin/quotes/${quote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          showToast(json.error || "Couldn't save quote", "error");
          return false;
        }
        showToast("Quote saved", "success");
        router.refresh();
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote() {
    if (mode === "create" || !quote) {
      showToast("Save the quote first", "error");
      return;
    }
    setSending(true);
    try {
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
      showToast(json.mode === "mock" ? "Quote marked sent (no email provider configured, see Settings)" : "Quote emailed to customer", "success");
      setConfirmSend(false);
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

  async function confirmCancelQuote() {
    setCancelling(true);
    await setStatus("CANCELLED");
    setCancelling(false);
    setConfirmCancel(false);
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

  async function createRevision() {
    if (!quote) return;
    setRevising(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}/revise`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(json.error || "Couldn't create a revision", "error");
        return;
      }
      showToast("Revision created", "success");
      router.push(`/admin/quotes/${json.id}`);
    } finally {
      setRevising(false);
    }
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
    const data = await res.json().catch(() => null);
    setConfirmDelete(false);
    if (!res.ok || !data?.ok) {
      showToast(data?.error || "Couldn't delete quote", "error");
      return;
    }
    router.push("/admin/quotes");
  }

  const waNumber = customerPhone.replace(/[^\d]/g, "");
  const primaryServiceLine = serviceItems[0];
  const waText = encodeURIComponent(
    `Hi ${customerName.split(" ")[0] || ""}, here's your quote${quote ? ` (${quote.quoteNumber})` : ""} from Abbie's Clean Method: ${
      primaryServiceLine ? formatQuotedRate(Math.round(primaryServiceLine.unitPrice * 100), primaryServiceLine.pricingUnit) : `$${total.toFixed(2)} total`
    }.`
  );

  const previewData = {
    quoteNumber: quote?.quoteNumber ?? "Preview",
    revisionNumber: quote?.revisionNumber ?? 1,
    status: quote?.status ?? "DRAFT",
    createdAt: quote?.createdAt,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    customerName,
    companyName,
    serviceAddress,
    serviceName,
    approxSquareFeet,
    items: items.filter((i) => i.label.trim()).map((i, idx) => ({
      id: String(idx),
      label: i.label,
      quantity: i.pricingUnit ? 1 : i.quantity,
      unitPrice: Math.round(i.unitPrice * 100),
      total: i.pricingUnit ? Math.round(i.unitPrice * 100) : i.quantity * Math.round(i.unitPrice * 100),
      pricingUnit: i.pricingUnit || null,
      frequency: i.frequency || null,
      customFrequency: i.customFrequency || null,
    })),
    discount,
    tax: Math.round(tax * 100),
    deposit,
    total,
    scopeOfService,
    exclusions,
    notes,
    customerMessage,
  };

  return (
    <div>
      <Link href="/admin/quotes" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to quotes
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">
            {quote ? quote.quoteNumber : "New quote"}
            {quote && quote.revisionNumber > 1 && <span className="ml-2 text-base font-normal text-admin-text-muted">Revision {quote.revisionNumber}</span>}
          </h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            Lead <Link href="/admin/leads" className="text-admin-teal-hover hover:underline">{leadReference}</Link>
          </p>
        </div>
        {quote && <Badge tone={statusTone[quote.status]}>{quote.status}</Badge>}
      </div>

      {quote && quote.sentAt && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-admin-text-muted">
          <span>Sent {formatDateTime(quote.sentAt)}</span>
          {quote.viewedAt ? (
            <span className="inline-flex items-center gap-1 text-admin-teal-hover">
              <Eye className="size-3.5" aria-hidden /> Viewed by customer {formatDateTime(quote.viewedAt)}
            </span>
          ) : (
            <span>Not yet viewed by customer</span>
          )}
        </p>
      )}

      {quote && quote.revisions.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-admin-text-muted">
          <GitBranch className="size-3.5" aria-hidden /> Other revisions:{" "}
          {quote.revisions.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/admin/quotes/${r.id}`} className="text-admin-teal-hover hover:underline">Rev {r.revisionNumber} ({r.status})</Link>
            </span>
          ))}
        </p>
      )}

      {/* Client / Property header -- fetched through the real lead/customer/address/quote-request
          relationships, nothing duplicated into this screen's own storage. */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-admin-text">{customerName || "—"}</p>
            {companyName && <p className="text-sm text-admin-text">{companyName}</p>}
            <p className={serviceAddress ? "text-sm text-admin-text-muted" : "text-sm italic text-admin-text-muted"}>{serviceAddress || "Service address not provided"}</p>
          </div>
          <div className="text-right text-sm text-admin-text-muted">
            <p className="font-medium text-admin-text">{serviceName}</p>
            {approxSquareFeet ? <p>Approx. {approxSquareFeet.toLocaleString("en-US")} sq. ft.</p> : null}
            {customerEmail && <p>{customerEmail}</p>}
            {customerPhone && <p>{customerPhone}</p>}
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="font-semibold text-admin-text">Primary Service</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Define the service, frequency, and rate.</p>
            <div className="mt-3 space-y-3">
              {serviceRowIndices.length > 0 ? serviceRowIndices.map(renderItemRow) : (
                <p className="rounded-xl border border-dashed border-admin-border p-3 text-sm text-admin-text-muted">No recurring service added yet.</p>
              )}
            </div>
            {isDraft && (
              <button type="button" onClick={addServiceItem} className="ios-press mt-3 inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg">
                <Plus className="size-3.5" aria-hidden /> Add service
              </button>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-admin-text-muted">Optional Additional Line Items</h2>
            <p className="mt-1 text-xs text-admin-text-muted">For add-ons like carpet cleaning, interior windows, or a one-time deep clean -- billed by quantity × price, not a recurring rate.</p>
            {plainRowIndices.length > 0 && (
              <div className="mt-3 space-y-3">
                {plainRowIndices.map(renderItemRow)}
              </div>
            )}
            {isDraft && (
              <button type="button" onClick={addPlainItem} className="ios-press mt-3 inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text-muted hover:bg-admin-bg">
                <Plus className="size-3.5" aria-hidden /> Add simple line item
              </button>
            )}
          </Card>

          {validPromo && (
            <Card>
              {!promoApplied ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-admin-teal/10 p-3">
                  <p className="flex items-center gap-2 text-sm text-admin-text">
                    <Tag className="size-4 text-admin-teal" aria-hidden />
                    Customer entered promo code <strong className="font-mono">{validPromo.code}</strong>,{" "}
                    {validPromo.discountType === "PERCENT" ? `${validPromo.discountValue}% off` : `$${(validPromo.discountValue / 100).toFixed(2)} off`}
                  </p>
                  <button type="button" onClick={applyPromo} className="ios-press rounded-full bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover">
                    Apply to discount
                  </button>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-admin-success">
                  <Tag className="size-4" aria-hidden /> Promo code {validPromo.code} applied
                </p>
              )}
            </Card>
          )}

          <Card>
            <h2 className="font-semibold text-admin-text">Discount, tax & deposit</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Optional. No tax is added automatically, and a deposit isn&apos;t required.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="text-xs font-medium text-admin-text-muted">Discount</span>
                <div className="mt-1 flex gap-2">
                  <select value={discountType} disabled={!isDraft} onChange={(e) => setDiscountType(e.target.value)} className="rounded-lg border border-admin-border px-2 py-1.5 text-sm text-admin-text disabled:bg-admin-bg">
                    <option value="FIXED">$</option>
                    <option value="PERCENT">%</option>
                  </select>
                  <input type="number" min={0} step={discountType === "PERCENT" ? 1 : 0.01} max={discountType === "PERCENT" ? 100 : undefined} value={discountValue} disabled={!isDraft} onChange={(e) => setDiscountValue(Number(e.target.value) || 0)} className="w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Tax ($)</span>
                <input type="number" min={0} step="0.01" value={tax} disabled={!isDraft} onChange={(e) => setTax(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
              </label>
              <div>
                <span className="text-xs font-medium text-admin-text-muted">Deposit</span>
                <div className="mt-1 flex gap-2">
                  <select value={depositType} disabled={!isDraft} onChange={(e) => setDepositType(e.target.value)} className="rounded-lg border border-admin-border px-2 py-1.5 text-sm text-admin-text disabled:bg-admin-bg">
                    <option value="NONE">None</option>
                    <option value="FIXED">$</option>
                    <option value="PERCENT">%</option>
                  </select>
                  {depositType !== "NONE" && (
                    <input type="number" min={0} step={depositType === "PERCENT" ? 1 : 0.01} max={depositType === "PERCENT" ? 100 : undefined} value={depositValue} disabled={!isDraft} onChange={(e) => setDepositValue(Number(e.target.value) || 0)} className="w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-admin-text-muted">Expires</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {EXPIRY_PRESETS.map((p) => (
                    <button key={p.days} type="button" disabled={!isDraft} onClick={() => setExpiryPreset(p.days)} className="ios-press rounded-full border border-admin-border px-2.5 py-1 text-xs font-medium text-admin-text hover:bg-admin-bg disabled:opacity-60">
                      {p.label}
                    </button>
                  ))}
                  <input type="date" value={expiresAt} disabled={!isDraft} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-admin-text">Scope of Service</h2>
                <p className="mt-1 text-xs text-admin-text-muted">Customer-facing -- appears on the quote and email. Shown exactly as typed, so use line breaks for a list.</p>
              </div>
              {isDraft && (
                <label className="shrink-0">
                  <span className="sr-only">Use template</span>
                  <select
                    value=""
                    onChange={(e) => applyScopeTemplate(e.target.value)}
                    className="rounded-full border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg"
                  >
                    <option value="">Use Template…</option>
                    {SCOPE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </label>
              )}
            </div>
            <textarea value={scopeOfService} disabled={!isDraft} onChange={(e) => setScopeOfService(e.target.value)} rows={5} placeholder={"e.g.\n- Dust and wipe accessible surfaces\n- Vacuum carpeted areas\n- Clean and disinfect restrooms"} className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
          </Card>

          <Card>
            <h2 className="font-semibold text-admin-text">Exclusions / Special Conditions</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Customer-facing -- what this quote does NOT cover.</p>
            <textarea value={exclusions} disabled={!isDraft} onChange={(e) => setExclusions(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
          </Card>

          <Card>
            <h2 className="font-semibold text-admin-text">Customer Notes / Terms</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Customer-facing -- appears on the quote and email.</p>
            <textarea value={notes} disabled={!isDraft} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
          </Card>

          <Card>
            <h2 className="font-semibold text-admin-text">Message to Customer</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Customer-facing -- appears near the end of the quote.</p>
            <textarea value={customerMessage} disabled={!isDraft} onChange={(e) => setCustomerMessage(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
          </Card>

          <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
            <h2 className="flex items-center gap-1.5 font-semibold text-admin-text"><Lock className="size-4 text-amber-700" aria-hidden /> Internal Notes</h2>
            <p className="mt-1 text-xs font-semibold text-amber-800">Private — visible to Abbie&apos;s Clean Method staff only. Never appears on the quote, email, or any customer-facing page.</p>
            <textarea value={internalNotes} disabled={!isDraft} onChange={(e) => setInternalNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-admin-border bg-white px-2.5 py-1.5 text-sm text-admin-text disabled:bg-admin-bg" />
          </Card>
        </div>

        <div className="order-first space-y-4 lg:order-none lg:sticky lg:top-4 lg:self-start">
          <Card>
            <h2 className="font-semibold text-admin-text">Quote Summary</h2>

            {serviceItems.length > 0 ? (
              <div className="mt-3 space-y-3">
                {serviceItems.map((i, idx) => {
                  const freq = formatFrequency(i.frequency, i.customFrequency);
                  return (
                    <div key={idx}>
                      <p className="text-sm font-medium text-admin-text">{i.label || "Service"}</p>
                      {freq && <p className="text-xs text-admin-text-muted">{freq}</p>}
                      <p className="text-2xl font-bold tracking-tight text-admin-teal-hover">{formatQuotedRate(Math.round(i.unitPrice * 100), i.pricingUnit)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-admin-text-muted">Add a service above to see its quoted rate.</p>
            )}

            {plainItems.length > 0 && (
              <p className="mt-3 text-sm text-admin-text-muted">
                + {plainItems.length} additional line item{plainItems.length > 1 ? "s" : ""}: ${plainItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}
              </p>
            )}

            {!hasServiceLine && (
              <div className="mt-3 flex justify-between border-t border-admin-border pt-2 text-sm font-semibold">
                <dt className="text-admin-text">Total</dt><dd className="text-admin-text">${total.toFixed(2)}</dd>
              </div>
            )}

            <dl className="mt-3 space-y-1 border-t border-admin-border pt-2 text-sm">
              {discount > 0 && <div className="flex justify-between"><dt className="text-admin-text-muted">Discount</dt><dd className="text-admin-text">-${(discount / 100).toFixed(2)}</dd></div>}
              {tax > 0 && <div className="flex justify-between"><dt className="text-admin-text-muted">Tax</dt><dd className="text-admin-text">${tax.toFixed(2)}</dd></div>}
              <div className="flex justify-between"><dt className="text-admin-text-muted">Deposit</dt><dd className="text-admin-text">{depositType === "NONE" ? "None" : `$${(deposit / 100).toFixed(2)}`}</dd></div>
            </dl>

            {internalMonthlyEstimates.length > 0 && (
              <p className="mt-3 text-xs text-admin-text-muted">
                Internal estimate only, not shown to customer: ~${(internalMonthlyEstimates.reduce((s, e) => s + e.value, 0) / 100).toFixed(2)} / month
              </p>
            )}

            {isDraft && (
              <button type="button" onClick={save} disabled={saving} className="ios-press mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {mode === "create" ? "Save Draft" : "Save changes"}
              </button>
            )}

            <button type="button" onClick={() => setPreviewOpen(true)} className="ios-press mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-admin-border px-4 py-2.5 text-sm font-semibold text-admin-text hover:bg-admin-bg">
              <Eye className="size-4" aria-hidden /> Preview Quote
            </button>

            {mode === "edit" && quote?.status === "DRAFT" && (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Optional message to include in the email…"
                  className="mt-3 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                />
                <button type="button" onClick={() => setConfirmSend(true)} className="ios-press mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-admin-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                  <Send className="size-4" aria-hidden /> Send Quote
                </button>
              </>
            )}

            {quote && waNumber && quote.status !== "DRAFT" && (
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
                {["SENT", "DECLINED", "EXPIRED", "CANCELLED"].includes(quote.status) && (
                  <button type="button" onClick={createRevision} disabled={revising} className="ios-press flex items-center justify-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg disabled:opacity-60">
                    {revising ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GitBranch className="size-3.5" aria-hidden />} Create revision
                  </button>
                )}
                <button type="button" onClick={duplicate} className="ios-press flex items-center justify-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
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
                {["SENT"].includes(quote.status) && (
                  <button type="button" onClick={() => setConfirmCancel(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-admin-error/30 px-3 py-2 text-sm font-semibold text-admin-error hover:bg-red-50">
                    <Ban className="size-3.5" aria-hidden /> Cancel quote
                  </button>
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

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this quote?"
        description="The customer will no longer be able to accept it online. This is different from Decline -- use this when the business itself is calling it off."
        confirmLabel={cancelling ? "Cancelling…" : "Cancel quote"}
        tone="danger"
        onConfirm={confirmCancelQuote}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmSend}
        title="Send this quote to the customer?"
        description={`This emails ${customerEmail || "the customer"} the quote shown in the preview. Use Preview first if you haven't already.`}
        confirmLabel={sending ? "Sending…" : "Send quote"}
        onConfirm={sendQuote}
        onCancel={() => setConfirmSend(false)}
      />

      {previewOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 print:static print:block print:h-auto print:overflow-visible print:bg-white print:p-0">
            <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl print:my-0 print:max-w-none print:rounded-none print:shadow-none">
              <div className="flex items-center justify-between gap-3 border-b border-surface-200 p-4 print:hidden">
                <p className="text-sm font-semibold text-navy-950">Preview -- exactly what the customer will see. Nothing has been sent.</p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="ios-press flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-semibold text-navy-950 hover:bg-surface-50"
                  >
                    <Printer className="size-4" aria-hidden /> Download PDF
                  </button>
                  <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Close preview" className="flex size-8 items-center justify-center rounded-lg text-surface-700 hover:bg-surface-100">
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div id="printable-area" className="p-5 print:p-0">
                <CustomerQuoteView quote={previewData} business={business} contact={contact} logoUrl={logoUrl} />
              </div>
            </div>
          </div>,
          document.body
        )}

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
                    <li key={c.reference}>{c.customerName}, {c.scheduledStart ? formatDateTime(c.scheduledStart) : ""}</li>
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
