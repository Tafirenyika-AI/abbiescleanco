"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Briefcase, DollarSign, Wallet, Banknote } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import StatCard from "@/components/admin/ui/StatCard";
import { useToast } from "@/components/admin/ui/Toast";
import {
  SUBCONTRACTOR_PAY_TYPES,
  subcontractorPayTypeLabels,
  type SubcontractorRow,
  type SubcontractorPayables,
  type SubcontractorPayType,
  type SubcontractorStatusValue,
} from "@/lib/subcontractors";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SubcontractorDetail({
  subcontractor, payables, canRecordPayout,
}: {
  subcontractor: SubcontractorRow;
  payables: SubcontractorPayables;
  canRecordPayout: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [name, setName] = useState(subcontractor.name);
  const [email, setEmail] = useState(subcontractor.email ?? "");
  const [phone, setPhone] = useState(subcontractor.phone ?? "");
  const [payType, setPayType] = useState<SubcontractorPayType>(subcontractor.payType);
  const [payRate, setPayRate] = useState(subcontractor.payType !== "PERCENTAGE" ? String(subcontractor.payRateCents / 100) : "");
  const [payRatePercent, setPayRatePercent] = useState(subcontractor.payRatePercent ? String(subcontractor.payRatePercent) : "");
  const [taxIdLast4, setTaxIdLast4] = useState(subcontractor.taxIdLast4 ?? "");
  const [status, setStatus] = useState<SubcontractorStatusValue>(subcontractor.status);
  const [notes, setNotes] = useState(subcontractor.notes ?? "");
  const [saving, setSaving] = useState(false);

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [payoutNote, setPayoutNote] = useState("");
  const [recordingPayout, setRecordingPayout] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/finance/subcontractors/${subcontractor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email: email || null, phone: phone || null, payType,
        payRateCents: payType !== "PERCENTAGE" ? Math.round(Number(payRate || 0) * 100) : undefined,
        payRatePercent: payType === "PERCENTAGE" ? Number(payRatePercent || 0) : null,
        taxIdLast4: taxIdLast4 || null, status, notes: notes || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't save", "error");
    showToast("Saved.", "success");
    router.refresh();
  }

  async function recordPayout() {
    const amountCents = Math.round(Number(payoutAmount || 0) * 100);
    if (amountCents <= 0) return;
    setRecordingPayout(true);
    const res = await fetch(`/api/admin/finance/subcontractors/${subcontractor.id}/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents, date: payoutDate, note: payoutNote || undefined }),
    });
    const data = await res.json().catch(() => null);
    setRecordingPayout(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't record payout", "error");
    showToast("Payout recorded.", "success");
    setPayoutAmount("");
    setPayoutNote("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/finance/subcontractors" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to subcontractors
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-admin-text">{subcontractor.name}</h1>
        <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>{status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
      </div>

      {!payables.autoCalculated && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Flat monthly pay isn&apos;t tied to individual jobs, so earned/owed can&apos;t be auto-calculated from completed bookings -- just record real payouts below as they happen.</p>
        </div>
      )}

      <div className="admin-stats">
        <StatCard label="Completed jobs" value={String(payables.completedJobsCount)} icon={Briefcase} />
        {payables.autoCalculated && <StatCard label="Earned" value={money(payables.earnedCents)} icon={DollarSign} hint={payables.uncomputableJobsCount > 0 ? `${payables.uncomputableJobsCount} job(s) couldn't be auto-calculated` : undefined} />}
        <StatCard label="Paid" value={money(payables.paidCents)} icon={Wallet} />
        <StatCard label="Owed" value={money(Math.max(0, payables.owedCents))} icon={Banknote} hint={payables.owedCents < 0 ? `Overpaid by ${money(-payables.owedCents)}` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-admin-text">Details</h2>
          <div className="mt-3 space-y-2.5 text-sm">
            <label className="block">
              <span className="text-xs text-admin-text-muted">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-admin-text-muted">Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs text-admin-text-muted">Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-admin-text-muted">Pay type</span>
              <select value={payType} onChange={(e) => setPayType(e.target.value as SubcontractorPayType)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                {SUBCONTRACTOR_PAY_TYPES.map((p) => <option key={p} value={p}>{subcontractorPayTypeLabels[p]}</option>)}
              </select>
            </label>
            {payType === "PERCENTAGE" ? (
              <label className="block">
                <span className="text-xs text-admin-text-muted">Percent of job total</span>
                <input type="number" min="1" max="100" value={payRatePercent} onChange={(e) => setPayRatePercent(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
            ) : (
              <label className="block">
                <span className="text-xs text-admin-text-muted">{payType === "HOURLY" ? "Rate per hour ($)" : payType === "FLAT_MONTHLY" ? "Flat monthly amount ($)" : "Rate per job ($)"}</span>
                <input type="number" min="0" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
            )}
            <label className="block">
              <span className="text-xs text-admin-text-muted">Tax ID, last 4 digits only (for 1099 records)</span>
              <input value={taxIdLast4} onChange={(e) => setTaxIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs text-admin-text-muted">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as SubcontractorStatusValue)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-admin-text-muted">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <button type="button" onClick={save} disabled={saving} className="ios-press rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Card>

        {canRecordPayout && (
          <Card>
            <h2 className="font-semibold text-admin-text">Record a payout</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Recorded as a real expense (category: Subcontractors) -- this is what reduces the amount owed above.</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <label className="block">
                <span className="text-xs text-admin-text-muted">Amount ($)</span>
                <input type="number" min="0.01" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs text-admin-text-muted">Date</span>
                <input type="date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs text-admin-text-muted">Note (optional)</span>
                <input value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <button type="button" onClick={recordPayout} disabled={recordingPayout || !payoutAmount} className="ios-press rounded-lg bg-admin-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {recordingPayout ? "Recording…" : "Record payout"}
              </button>
            </div>
          </Card>
        )}
      </div>

      {payables.autoCalculated && (
        <Card>
          <h2 className="font-semibold text-admin-text">Completed jobs</h2>
          {payables.jobs.length === 0 ? (
            <p className="mt-2 text-sm text-admin-text-muted">No completed jobs assigned to this subcontractor yet.</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-admin-border">
              <table className="w-full text-sm">
                <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
                  <tr>
                    <th className="px-3 py-2">Job</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.jobs.map((j) => (
                    <tr key={j.bookingId} className="border-t border-admin-border">
                      <td className="px-3 py-2"><Link href={`/admin/bookings/${j.bookingId}`} className="text-admin-teal-hover hover:underline">{j.reference}</Link></td>
                      <td className="px-3 py-2 text-admin-text-muted">{j.completedDate ? new Date(j.completedDate).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2 text-admin-text-muted">{j.earnedCents !== null ? money(j.earnedCents) : <span className="text-amber-700">{j.reason}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
