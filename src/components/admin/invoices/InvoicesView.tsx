"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, FileStack, AlertCircle, Link2, Copy, Mail, Check } from "lucide-react";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import { type InvoiceListItem, type InvoiceableQuote, type CompletedUninvoicedBooking, invoiceStatusLabels, invoiceStatusTone } from "@/lib/invoices";
import { formatDate } from "@/lib/adminDate";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** An invoice can be included in a Stripe payment link only if there's really something left to
 *  collect online for it -- same real-world constraints createPaymentLinkForInvoices enforces
 *  server-side (one customer, a linked booking, not cancelled, a positive balance). Checked again
 *  here so a disabled checkbox already explains why, instead of a surprise error after selecting. */
function payableReason(inv: InvoiceListItem): string | null {
  if (inv.status === "CANCELLED") return "Cancelled invoices can't be paid online.";
  if (inv.balance <= 0) return "Already paid in full.";
  if (!inv.bookingId) return "No linked booking, so this can't be paid online yet.";
  return null;
}

function CompletedUninvoicedPanel({ initialBookings }: { initialBookings: CompletedUninvoicedBooking[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState(initialBookings);
  const [generating, setGenerating] = useState<string | null>(null);

  async function generate(b: CompletedUninvoicedBooking) {
    setGenerating(b.bookingId);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: b.quoteId, bookingId: b.bookingId }),
    });
    const data = await res.json().catch(() => null);
    setGenerating(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't generate invoice", "error");
    setBookings((prev) => prev.filter((x) => x.bookingId !== b.bookingId));
    showToast("Invoice generated.", "success");
    router.push(`/admin/invoices/${data.id}`);
  }

  if (bookings.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-amber-900">{bookings.length} completed job{bookings.length === 1 ? "" : "s"} never invoiced</p>
          <p className="mt-0.5 text-xs text-amber-800">A job was marked complete but no invoice was ever generated for it. One click creates it from the real accepted quote -- nothing is sent until you choose to email it.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {bookings.map((b) => (
          <li key={b.bookingId} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3.5 py-2.5">
            <div>
              <p className="text-sm font-medium text-admin-text">{b.customerName}, {b.serviceName}</p>
              <p className="text-xs text-admin-text-muted">{b.reference} · {b.serviceDate ? `Serviced ${formatDate(b.serviceDate)}` : "No service date"} · {money(b.total)}</p>
            </div>
            <button
              type="button"
              onClick={() => generate(b)}
              disabled={generating === b.bookingId}
              className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {generating === b.bookingId && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Generate invoice
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InvoicesView({ invoices, completedUninvoiced }: { invoices: InvoiceListItem[]; completedUninvoiced: CompletedUninvoicedBooking[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const selectedInvoices = invoices.filter((inv) => selected.has(inv.id));
  const selectedTotal = selectedInvoices.reduce((sum, inv) => sum + inv.balance, 0);
  const selectedCustomerIds = new Set(selectedInvoices.map((inv) => inv.customerId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      <CompletedUninvoicedPanel initialBookings={completedUninvoiced} />

      {invoices.length === 0 ? (
        <EmptyState icon={FileStack} title="No invoices yet" description="Issue an invoice from any accepted quote." />
      ) : (
        <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
          <table className="w-full text-sm">
            <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
              <tr>
                <th className="w-10 px-4 py-2.5"></th>
                <th className="px-4 py-2.5">Invoice #</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Service date</th>
                <th className="px-4 py-2.5">Total</th>
                <th className="px-4 py-2.5">Balance</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const blockedReason = payableReason(inv);
                return (
                  <tr key={inv.id} className="border-t border-admin-border transition-colors duration-150 hover:bg-admin-bg">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(inv.id)}
                        disabled={!!blockedReason}
                        onChange={() => toggle(inv.id)}
                        title={blockedReason ?? "Select for a payment link"}
                        className="size-4 accent-admin-teal disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/invoices/${inv.id}`} className="font-medium text-admin-teal-hover hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-admin-text">{inv.customerName}</td>
                    <td className="px-4 py-2.5 text-admin-text-muted">
                      {inv.serviceDate ? formatDate(inv.serviceDate) : <span className="italic">No job linked</span>}
                    </td>
                    <td className="px-4 py-2.5 text-admin-text">{money(inv.total)}</td>
                    <td className="px-4 py-2.5 text-admin-text-muted">
                      {inv.status === "CANCELLED" || inv.balance <= 0 ? "—" : `${money(inv.balance)} due`}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone={invoiceStatusTone[inv.status]}>{invoiceStatusLabels[inv.status]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-admin-border bg-admin-card px-5 py-3.5 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] sm:inset-x-6 sm:bottom-4 sm:rounded-2xl sm:border">
          <div className="text-sm text-admin-text">
            <span className="font-semibold">{selected.size}</span> invoice{selected.size === 1 ? "" : "s"} selected · <span className="font-semibold">{money(selectedTotal)}</span> total
            {selectedCustomerIds.size > 1 && <span className="ml-2 text-xs font-medium text-red-700">Different customers -- pick invoices from one customer only.</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="ios-press rounded-full px-3 py-1.5 text-sm font-medium text-admin-text-muted hover:bg-admin-bg">Clear</button>
            <button
              type="button"
              onClick={() => setLinkModalOpen(true)}
              disabled={selectedCustomerIds.size !== 1}
              className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Link2 className="size-4" aria-hidden /> Generate payment link
            </button>
          </div>
        </div>
      )}

      {linkModalOpen && (
        <GeneratePaymentLinkModal
          invoices={selectedInvoices}
          onClose={() => setLinkModalOpen(false)}
          onDone={() => {
            setLinkModalOpen(false);
            setSelected(new Set());
          }}
        />
      )}

      {pickerOpen && <NewInvoicePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

/** Builds one Stripe Payment Link covering the given invoices' real outstanding balances --
 *  reused both from this multi-select bar and (with a single invoice) from the invoice detail
 *  page's "Get payment link" button. */
export function GeneratePaymentLinkModal({ invoices, onClose, onDone }: { invoices: InvoiceListItem[]; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast();
  const [emailToCustomer, setEmailToCustomer] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const total = useMemo(() => invoices.reduce((sum, inv) => sum + inv.balance, 0), [invoices]);
  const sameCustomerEmail = invoices.length > 0 ? invoices[0].customerEmail : null;
  const canEmail = invoices.every((inv) => inv.customerEmail === sameCustomerEmail) && !!sameCustomerEmail;

  async function generate() {
    setGenerating(true);
    const res = await fetch("/api/admin/invoices/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds: invoices.map((inv) => inv.id), emailToCustomer: emailToCustomer && canEmail }),
    });
    const data = await res.json().catch(() => null);
    setGenerating(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't generate payment link", "error");
    setResult({ url: data.url, emailed: !!data.emailed });
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-admin-text">{result ? "Payment link ready" : "Generate payment link"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ios-press rounded-lg p-1.5 text-admin-text-muted hover:bg-admin-bg"><X className="size-5" aria-hidden /></button>
        </div>

        {!result ? (
          <>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-admin-text">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between">
                  <span>{inv.invoiceNumber}</span>
                  <span className="text-admin-text-muted">{money(inv.balance)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-admin-border pt-2 text-sm font-semibold text-admin-text">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <p className="mt-3 text-xs text-admin-text-muted">
              Creates one real, permanent Stripe payment link for this amount. It stays on file here (visible on each invoice) whether or not it&apos;s ever paid.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-admin-text">
              <input type="checkbox" checked={emailToCustomer && canEmail} disabled={!canEmail} onChange={(e) => setEmailToCustomer(e.target.checked)} className="size-4 accent-admin-teal" />
              Email this link to the customer now{!canEmail && <span className="text-xs text-admin-text-muted">(no email on file)</span>}
            </label>
            <button type="button" onClick={generate} disabled={generating} className="ios-press mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {generating && <Loader2 className="size-4 animate-spin" aria-hidden />} Generate link
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-admin-text-muted">{result.emailed ? "Emailed to the customer and saved for your records." : "Saved for your records. Copy it below to send yourself."}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text">
              <span className="flex-1 truncate">{result.url}</span>
              <button type="button" onClick={copyLink} className="ios-press rounded-md p-1.5 text-admin-text-muted hover:bg-admin-card">
                {copied ? <Check className="size-4 text-green-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              </button>
            </div>
            {result.emailed && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-green-700"><Mail className="size-3.5" aria-hidden /> Sent to the customer</p>
            )}
            <button type="button" onClick={onDone} className="ios-press mt-4 w-full rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white">Done</button>
          </>
        )}
      </div>
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
