"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Phone, Mail, Loader2, CreditCard, Copy, ExternalLink, Star } from "lucide-react";
import type { BookingDetail, BookingStatusValue } from "@/lib/server/bookingStore";
import { bookingStatusLabels } from "@/lib/server/bookingStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDateTime } from "@/lib/adminDate";

const statusTone: Record<BookingStatusValue, "neutral" | "info" | "success" | "error" | "warning"> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "error",
  RESCHEDULED: "warning",
};

/** The single logical next step from each status — shown as the primary action so "Update status" guides you forward instead of listing all 6 other statuses as equal options. */
const nextStatus: Partial<Record<BookingStatusValue, BookingStatusValue>> = {
  REQUESTED: "CONFIRMED",
  CONFIRMED: "IN_PROGRESS",
  SCHEDULED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  RESCHEDULED: "CONFIRMED",
};
const nextStatusActionLabel: Partial<Record<BookingStatusValue, string>> = {
  REQUESTED: "Confirm booking",
  CONFIRMED: "Start job",
  SCHEDULED: "Start job",
  IN_PROGRESS: "Mark completed",
  RESCHEDULED: "Re-confirm booking",
};
// RESCHEDULED is deliberately excluded here — it's only ever set as a side effect of the
// dedicated "Reschedule" form below (which also changes the date/time), never as a bare
// status flip with no date change, since that would produce a nonsensical state.
const OTHER_SELECTABLE_STATUSES: BookingStatusValue[] = ["REQUESTED", "CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}
function toTimeInput(iso: string | null) {
  return iso ? new Date(iso).toTimeString().slice(0, 5) : "";
}

export default function BookingDetailView({ booking }: { booking: BookingDetail }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [staff, setStaff] = useState(booking.staffAssignee ?? "");
  const [savingStaff, setSavingStaff] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(toDateInput(booking.scheduledStart));
  const [start, setStart] = useState(toTimeInput(booking.scheduledStart));
  const [end, setEnd] = useState(toTimeInput(booking.scheduledEnd));
  const [arrivalWindow, setArrivalWindow] = useState(booking.arrivalWindow ?? "");
  const [conflicts, setConflicts] = useState<{ reference: string; customerName: string; scheduledStart: string | null }[] | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [payKind, setPayKind] = useState<"deposit" | "full_payment">("full_payment");
  const [emailToCustomer, setEmailToCustomer] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");
  const [paymentLinkError, setPaymentLinkError] = useState("");
  const [sendingReviewRequest, setSendingReviewRequest] = useState(false);
  const [reviewRequestSent, setReviewRequestSent] = useState(false);

  const [earlyStart, setEarlyStart] = useState<{ earliest: string } | null>(null);
  const [earlyNote, setEarlyNote] = useState("");
  const [startingEarly, setStartingEarly] = useState(false);

  async function setStatus(status: BookingStatusValue, note?: string) {
    const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    if (res.status === 409) {
      const json = await res.json();
      if (json.code === "TOO_EARLY") {
        setEarlyStart({ earliest: json.earliest });
        return false;
      }
    }
    if (!res.ok) {
      showToast("Couldn't update status", "error");
      return false;
    }
    showToast(`Marked ${bookingStatusLabels[status].toLowerCase()}`, "success");
    router.refresh();
    return true;
  }

  async function confirmEarlyStart() {
    setStartingEarly(true);
    const ok = await setStatus("IN_PROGRESS", earlyNote.trim());
    setStartingEarly(false);
    if (ok) {
      setEarlyStart(null);
      setEarlyNote("");
    }
  }

  // Mirrors the server rule (bookingStore.EARLY_START_GRACE_MINUTES) purely to show a hint; the server is what enforces it.
  const startsEarliestAt = booking.scheduledStart ? new Date(new Date(booking.scheduledStart).getTime() - 20 * 60 * 1000) : null;
  const [renderedAt] = useState(() => Date.now());
  const tooEarlyToStart = !!startsEarliestAt && startsEarliestAt.getTime() > renderedAt;

  async function saveStaff() {
    setSavingStaff(true);
    const res = await fetch(`/api/admin/bookings/${booking.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffAssignee: staff }),
    });
    setSavingStaff(false);
    if (!res.ok) {
      showToast("Couldn't assign cleaner", "error");
      return;
    }
    showToast("Cleaner assigned", "success");
    router.refresh();
  }

  async function saveReschedule(confirmDespiteConflict = false) {
    if (!date || !start || !end) return;
    setSavingSchedule(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledStart: `${date}T${start}:00`,
          scheduledEnd: `${date}T${end}:00`,
          arrivalWindow: arrivalWindow || undefined,
          confirmDespiteConflict,
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setConflicts(json.conflicts);
        return;
      }
      if (!res.ok || !json.ok) {
        showToast(json.error || "Couldn't reschedule", "error");
        return;
      }
      showToast("Rescheduled", "success");
      setConflicts(null);
      setRescheduling(false);
      router.refresh();
    } finally {
      setSavingSchedule(false);
    }
  }

  async function generatePaymentLink() {
    if (!payAmount) return;
    setGeneratingLink(true);
    setPaymentLinkError("");
    setPaymentLinkUrl("");
    try {
      const res = await fetch("/api/admin/payments/checkout-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          amount: Math.round(Number(payAmount) * 100),
          kind: payKind,
          emailToCustomer,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setPaymentLinkError(json.error || "Couldn't generate a payment link");
        return;
      }
      setPaymentLinkUrl(json.url);
      showToast(emailToCustomer ? "Payment link emailed to the customer" : "Payment link created", "success");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function sendReviewRequest() {
    setSendingReviewRequest(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/review-request`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(json.error || "Couldn't send review request", "error");
        return;
      }
      setReviewRequestSent(true);
      showToast("Review request sent", "success");
    } finally {
      setSendingReviewRequest(false);
    }
  }

  async function confirmDeleteBooking() {
    const res = await fetch(`/api/admin/bookings/${booking.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    if (!res.ok) {
      showToast("Couldn't delete booking", "error");
      return;
    }
    router.push("/admin/bookings");
  }

  return (
    <div>
      <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to bookings
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">{booking.reference}</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{booking.customerName} · {booking.serviceName}</p>
        </div>
        <Badge tone={statusTone[booking.status]}>{bookingStatusLabels[booking.status]}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="font-semibold text-admin-text">Details</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Address</dt><dd className="text-right text-admin-text">{booking.address}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Scheduled</dt><dd className="text-admin-text">{booking.scheduledStart ? formatDateTime(booking.scheduledStart) : "Not scheduled"}</dd></div>
              {booking.arrivalWindow && <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Arrival window</dt><dd className="text-admin-text">{booking.arrivalWindow}</dd></div>}
            </dl>
            {booking.additionalInstructions && (
              <p className="mt-3 rounded-lg bg-admin-bg p-2.5 text-sm text-admin-text">{booking.additionalInstructions}</p>
            )}
            <div className="mt-3 flex gap-2">
              <a href={`tel:${booking.customerPhone}`} className="flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-1.5 text-sm text-admin-text hover:bg-admin-bg"><Phone className="size-3.5" aria-hidden /> Call</a>
              <a href={`mailto:${booking.customerEmail}`} className="flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-1.5 text-sm text-admin-text hover:bg-admin-bg"><Mail className="size-3.5" aria-hidden /> Email</a>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-admin-text">Schedule</h2>
              <button type="button" onClick={() => setRescheduling((v) => !v)} className="text-sm font-semibold text-admin-teal-hover hover:underline">
                {rescheduling ? "Cancel" : "Reschedule"}
              </button>
            </div>
            {rescheduling && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs font-medium text-admin-text-muted">Start</span>
                    <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-admin-text-muted">End</span>
                    <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Arrival window</span>
                  <input value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
                {conflicts && (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-semibold">This overlaps with:</p>
                    <ul className="mt-1 list-disc pl-4">
                      {conflicts.map((c) => <li key={c.reference}>{c.customerName} — {c.scheduledStart ? formatDateTime(c.scheduledStart) : ""}</li>)}
                    </ul>
                    <button type="button" onClick={() => saveReschedule(true)} disabled={savingSchedule} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">Reschedule anyway</button>
                  </div>
                )}
                <button type="button" onClick={() => saveReschedule(false)} disabled={savingSchedule} className="flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                  {savingSchedule ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Confirm reschedule
                </button>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold text-admin-text">Status history</h2>
            {booking.statusHistory.length === 0 ? (
              <p className="mt-2 text-sm text-admin-text-muted">No changes recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {booking.statusHistory.map((h) => (
                  <li key={h.id} className="rounded-lg border border-admin-border p-2.5">
                    <p className="text-admin-text">{bookingStatusLabels[h.toStatus as BookingStatusValue] ?? h.toStatus}{h.note ? ` — ${h.note}` : ""}</p>
                    <p className="text-xs text-admin-text-muted">{formatDateTime(h.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-1.5 font-semibold text-admin-text"><CreditCard className="size-4" aria-hidden /> Request payment</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Creates a secure Stripe Checkout link — card, Apple Pay, and Google Pay are all accepted automatically.</p>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <label className="flex-1 block">
                  <span className="text-xs font-medium text-admin-text-muted">Amount ($)</span>
                  <input type="number" min="0.50" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Kind</span>
                  <select value={payKind} onChange={(e) => setPayKind(e.target.value as typeof payKind)} className="mt-1 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                    <option value="full_payment">Full payment</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-admin-text">
                <input type="checkbox" checked={emailToCustomer} onChange={(e) => setEmailToCustomer(e.target.checked)} />
                Email the link to {booking.customerName || "the customer"}
              </label>
              <button
                type="button"
                onClick={generatePaymentLink}
                disabled={!payAmount || generatingLink}
                className="flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
              >
                {generatingLink ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}
                Generate payment link
              </button>
              {paymentLinkError && <p className="text-sm text-red-600">{paymentLinkError}</p>}
              {paymentLinkUrl && (
                <div className="flex items-center gap-2 rounded-lg bg-admin-bg p-2.5">
                  <input readOnly value={paymentLinkUrl} className="flex-1 truncate bg-transparent text-xs text-admin-text-muted" />
                  <button type="button" onClick={() => navigator.clipboard?.writeText(paymentLinkUrl).catch(() => {})} aria-label="Copy link" className="flex size-7 items-center justify-center rounded text-admin-text-muted hover:bg-white">
                    <Copy className="size-3.5" aria-hidden />
                  </button>
                  <a href={paymentLinkUrl} target="_blank" rel="noreferrer" aria-label="Open link" className="flex size-7 items-center justify-center rounded text-admin-text-muted hover:bg-white">
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-admin-text">Assigned cleaner</h2>
            <div className="mt-2 flex gap-2">
              <input value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="Unassigned" className="flex-1 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              <button type="button" onClick={saveStaff} disabled={savingStaff} className="rounded-lg bg-admin-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Save</button>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-admin-text">Update status</h2>
            <p className="mt-1 text-sm text-admin-text-muted">
              Currently <span className="font-semibold text-admin-text">{bookingStatusLabels[booking.status]}</span>
            </p>

            {nextStatus[booking.status] && (
              <button
                type="button"
                onClick={() => setStatus(nextStatus[booking.status]!)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-admin-teal px-3 py-2.5 text-sm font-semibold text-white hover:bg-admin-teal-hover"
              >
                {nextStatusActionLabel[booking.status]} <ArrowRight className="size-4" aria-hidden />
              </button>
            )}
            {nextStatus[booking.status] === "IN_PROGRESS" && tooEarlyToStart && startsEarliestAt && (
              <p className="mt-1.5 text-xs text-admin-text-muted">
                Opens {formatDateTime(startsEarliestAt.toISOString())} (20 min before start). Starting sooner needs an approval note.
              </p>
            )}

            {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
              <button
                type="button"
                onClick={() => setStatus("CANCELLED")}
                className="mt-2 w-full rounded-lg border border-admin-error/30 px-3 py-2 text-sm font-semibold text-admin-error hover:bg-red-50"
              >
                Cancel booking
              </button>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-admin-text-muted hover:text-admin-text">Set a different status</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {OTHER_SELECTABLE_STATUSES.filter((s) => s !== booking.status).map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)} className="rounded-lg border border-admin-border px-3 py-2 text-left text-sm font-medium text-admin-text hover:bg-admin-bg">
                    Mark {bookingStatusLabels[s].toLowerCase()}
                  </button>
                ))}
              </div>
            </details>
          </Card>

          {booking.status === "COMPLETED" && (
            <Card>
              <h2 className="flex items-center gap-1.5 font-semibold text-admin-text"><Star className="size-4" aria-hidden /> Review request</h2>
              <p className="mt-1 text-sm text-admin-text-muted">
                Only send this after confirming the customer is happy — it&apos;s never sent automatically.
              </p>
              <button
                type="button"
                onClick={sendReviewRequest}
                disabled={sendingReviewRequest || reviewRequestSent}
                className="mt-3 flex items-center gap-2 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
              >
                {sendingReviewRequest ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {reviewRequestSent ? "Sent" : "Send review request"}
              </button>
            </Card>
          )}

          <Card>
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full rounded-lg border border-admin-error/30 px-3 py-2 text-sm font-semibold text-admin-error hover:bg-red-50">
              Cancel &amp; delete booking
            </button>
          </Card>
        </div>
      </div>

      {earlyStart && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-admin-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-admin-text">Start this job early?</h2>
            <p className="mt-1 text-sm text-admin-text-muted">
              Jobs can be started from {formatDateTime(earlyStart.earliest)} (20 minutes before the scheduled start). To start sooner, add a note saying who approved it and why. It&apos;s saved to the booking history and the audit log.
            </p>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-admin-text-muted">Approval note (required)</span>
              <textarea
                value={earlyNote}
                onChange={(e) => setEarlyNote(e.target.value)}
                rows={3}
                placeholder="e.g. Customer asked us to come at 8am instead — confirmed by phone"
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              />
            </label>
            <p className="mt-2 text-xs text-admin-text-muted">Need to change the time instead? Cancel and use Reschedule.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setEarlyStart(null); setEarlyNote(""); }} className="rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                Cancel
              </button>
              <button
                type="button"
                disabled={!earlyNote.trim() || startingEarly}
                onClick={confirmEarlyStart}
                className="flex items-center gap-2 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
              >
                {startingEarly ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Approve &amp; start
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this booking?"
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDeleteBooking}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
