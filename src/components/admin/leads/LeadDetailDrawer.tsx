"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Phone, Mail, MessageCircle, Loader2, FileSignature, CalendarPlus } from "lucide-react";
import { LEAD_STATUSES, leadStatusLabels, type StoredLead, type LeadStatusValue, type LeadActivityEntry } from "@/lib/leads";
import { formatDateTime } from "@/lib/adminDate";
import { services } from "@/lib/data/services";
import Badge from "@/components/admin/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";

function statusTone(status: LeadStatusValue) {
  if (status === "LOST" || status === "CANCELLED") return "error" as const;
  if (status === "COMPLETED" || status === "CONFIRMED" || status === "SCHEDULED") return "success" as const;
  if (status === "NEW") return "info" as const;
  return "warning" as const;
}

export default function LeadDetailDrawer({
  lead,
  onClose,
  onUpdated,
}: {
  lead: StoredLead;
  onClose: () => void;
  onUpdated: (lead: StoredLead) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activity, setActivity] = useState<LeadActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [pendingLostStatus, setPendingLostStatus] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAddress, setScheduleAddress] = useState("");
  const [scheduleAddress2, setScheduleAddress2] = useState("");
  const [scheduleAmount, setScheduleAmount] = useState(
    !lead.estimate.requiresManualQuote ? String(Math.round((lead.estimate.totalLow + lead.estimate.totalHigh) / 2)) : ""
  );
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("11:00");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  async function submitSchedule() {
    setScheduling(true);
    setScheduleError("");
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/schedule-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressLine1: scheduleAddress,
          addressLine2: scheduleAddress2 || undefined,
          amount: Math.round(Number(scheduleAmount) * 100),
          scheduledStart: `${scheduleDate}T${scheduleStart}:00`,
          scheduledEnd: `${scheduleDate}T${scheduleEnd}:00`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setScheduleError(json.error || "Couldn't schedule this booking");
        return;
      }
      showToast("Booking scheduled", "success");
      router.push(`/admin/bookings/${json.id}`);
    } finally {
      setScheduling(false);
    }
  }

  const scheduleValid = scheduleAddress.trim() && Number(scheduleAmount) > 0 && scheduleDate && scheduleStart && scheduleEnd;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/leads/${lead.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) setActivity(json.activity);
        setLoadingActivity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.updatedAt]);

  async function changeStatus(status: LeadStatusValue, reason?: string) {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, lostReason: reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(json.error || "Couldn't update status", "error");
        return;
      }
      onUpdated(json.lead);
      showToast(`Status updated to ${leadStatusLabels[status]}`, "success");
    } finally {
      setSavingStatus(false);
      setPendingLostStatus(false);
    }
  }

  async function confirmDeleteLead() {
    setDeleting(true);
    const res = await fetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (!res.ok) {
      showToast("Couldn't delete lead", "error");
      return;
    }
    showToast("Lead deleted", "success");
    onClose();
  }

  const serviceName = services.find((s) => s.id === lead.input.service)?.name ?? lead.input.service;
  const fullName = `${lead.input.firstName} ${lead.input.lastName}`.trim();
  const waNumber = lead.input.phone.replace(/[^\d]/g, "");

  return (
    <>
      <button type="button" aria-label="Close lead details backdrop" onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/40" />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-admin-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-admin-border px-5 py-4">
          <div>
            <p className="text-xs text-admin-text-muted">{lead.reference}</p>
            <h2 className="text-lg font-semibold text-admin-text">{fullName || "Lead"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close lead details" className="flex size-8 items-center justify-center rounded-lg text-admin-text-muted hover:bg-admin-bg">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(lead.status)}>{leadStatusLabels[lead.status]}</Badge>
            {lead.estimate.requiresManualQuote && <Badge tone="warning">Manual quote</Badge>}
          </div>

          <div className="mt-4 flex gap-2">
            <a href={`tel:${lead.input.phone}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-admin-border py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
              <Phone className="size-4" aria-hidden /> Call
            </a>
            <a href={`mailto:${lead.input.email}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-admin-border py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
              <Mail className="size-4" aria-hidden /> Email
            </a>
            {waNumber && (
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-admin-border py-2 text-sm font-medium text-admin-text hover:bg-admin-bg"
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp
              </a>
            )}
          </div>

          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Contact</h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Email</dt><dd className="text-admin-text">{lead.input.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Phone</dt><dd className="text-admin-text">{lead.input.phone}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Preferred contact</dt><dd className="text-admin-text capitalize">{lead.input.preferredContactMethod}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Source</dt><dd className="text-admin-text capitalize">{lead.source}</dd></div>
            </dl>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Service & property</h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Service</dt><dd className="text-admin-text">{serviceName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Property type</dt><dd className="text-admin-text capitalize">{lead.input.propertyType}</dd></div>
              {lead.input.zip && <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">ZIP</dt><dd className="text-admin-text">{lead.input.zip}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Bedrooms / bathrooms</dt><dd className="text-admin-text">{lead.input.bedrooms} / {lead.input.bathrooms}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Frequency</dt><dd className="text-admin-text capitalize">{lead.input.frequency.replace(/-/g, " ")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Pets</dt><dd className="text-admin-text">{lead.input.hasPets ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-admin-text-muted">Preliminary estimate</dt>
                <dd className="text-admin-text">{lead.estimate.requiresManualQuote ? "Manual quote" : `$${lead.estimate.totalLow}–$${lead.estimate.totalHigh}`}</dd>
              </div>
              {lead.input.promoCode && (
                <div className="flex justify-between gap-3">
                  <dt className="text-admin-text-muted">Promo code entered</dt>
                  <dd className="font-mono font-semibold text-admin-text">{lead.input.promoCode}</dd>
                </div>
              )}
            </dl>
            {lead.input.additionalInstructions && (
              <p className="mt-2 rounded-lg bg-admin-bg p-2.5 text-sm text-admin-text">{lead.input.additionalInstructions}</p>
            )}
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Status</h3>
            <select
              aria-label="Lead status"
              value={lead.status}
              disabled={savingStatus}
              onChange={(e) => {
                const next = e.target.value as LeadStatusValue;
                if (next === "LOST") {
                  setPendingLostStatus(true);
                } else {
                  changeStatus(next);
                }
              }}
              className="mt-2 w-full rounded-lg border border-admin-border px-3 py-2 text-sm text-admin-text disabled:opacity-60"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{leadStatusLabels[s]}</option>
              ))}
            </select>
            {lead.status === "LOST" && lead.lostReason && (
              <p className="mt-2 text-xs text-admin-text-muted">Lost reason: {lead.lostReason}</p>
            )}
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Actions</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/admin/quotes/new?leadId=${lead.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-admin-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <FileSignature className="size-3.5" aria-hidden /> Create quote
              </Link>
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover"
              >
                <CalendarPlus className="size-3.5" aria-hidden /> Schedule booking
              </button>
              <span title="Coming soon" className="cursor-not-allowed rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                Assign
              </span>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Activity</h3>
            {loadingActivity ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-admin-text-muted"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…</p>
            ) : activity.length === 0 ? (
              <p className="mt-2 text-sm text-admin-text-muted">No changes recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="rounded-lg border border-admin-border p-2.5">
                    <p className="text-admin-text">{a.action.replace(/[._]/g, " ")}</p>
                    <p className="text-xs text-admin-text-muted">
                      {a.adminName ?? "System"} · {formatDateTime(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="border-t border-admin-border px-5 py-4">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-lg border border-admin-error/30 py-2 text-sm font-semibold text-admin-error hover:bg-red-50"
          >
            Delete lead
          </button>
        </div>
      </div>

      {pendingLostStatus && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-admin-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-admin-text">Why was this lead lost?</h2>
            <p className="mt-1 text-sm text-admin-text-muted">A reason is required so the team can learn from it.</p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              rows={3}
              placeholder="e.g. Went with another company, price too high…"
              className="mt-3 w-full rounded-lg border border-admin-border px-3 py-2 text-sm text-admin-text"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setPendingLostStatus(false); setLostReason(""); }} className="rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                Cancel
              </button>
              <button
                type="button"
                disabled={!lostReason.trim() || savingStatus}
                onClick={() => changeStatus("LOST", lostReason.trim())}
                className="rounded-lg bg-admin-error px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Mark as lost
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this lead?"
        description={`This removes ${fullName || lead.reference} from the leads list. This can't be undone from here.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        tone="danger"
        onConfirm={confirmDeleteLead}
        onCancel={() => setConfirmDelete(false)}
      />

      {scheduleOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-admin-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-admin-text">Schedule this cleaning</h2>
            <p className="mt-1 text-xs text-admin-text-muted">
              Creates an accepted quote and a confirmed booking together — skips building a quote by hand.
            </p>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Street address</span>
                <input value={scheduleAddress} onChange={(e) => setScheduleAddress(e.target.value)} placeholder="123 Main St" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Apt / unit (optional)</span>
                <input value={scheduleAddress2} onChange={(e) => setScheduleAddress2(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Amount ($)</span>
                <input type="number" min="1" step="0.01" value={scheduleAmount} onChange={(e) => setScheduleAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Date</span>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Start</span>
                  <input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">End</span>
                  <input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
              </div>
            </div>

            {scheduleError && <p className="mt-3 text-sm text-admin-error">{scheduleError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                Cancel
              </button>
              <button
                type="button"
                disabled={!scheduleValid || scheduling}
                onClick={submitSchedule}
                className="flex items-center gap-2 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
              >
                {scheduling ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Create booking
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
