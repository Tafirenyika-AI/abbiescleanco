"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Banknote } from "lucide-react";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import {
  SUBCONTRACTOR_PAY_TYPES,
  subcontractorPayTypeLabels,
  type SubcontractorRow,
  type SubcontractorPayType,
} from "@/lib/subcontractors";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SubcontractorsManager({ initialSubcontractors }: { initialSubcontractors: SubcontractorRow[] }) {
  const { showToast } = useToast();
  const [subcontractors, setSubcontractors] = useState(initialSubcontractors);
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">Subcontractors</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            Real independent cleaners/subcontractors on file, what they&apos;re owed (computed live from their completed jobs), and real payouts recorded against them.
          </p>
        </div>
        <button type="button" onClick={() => setShowNewForm(true)} className="ios-press inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
          <Plus className="size-4" aria-hidden /> New subcontractor
        </button>
      </div>

      {subcontractors.length === 0 ? (
        <EmptyState icon={Banknote} title="No subcontractors yet" description="Add one to start assigning jobs to them and tracking what's owed." />
      ) : (
        <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
          <table className="w-full text-sm">
            <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Pay type</th>
                <th className="px-4 py-2.5">Rate</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Contact</th>
              </tr>
            </thead>
            <tbody>
              {subcontractors.map((s) => (
                <tr key={s.id} className="cursor-pointer border-t border-admin-border transition-colors duration-150 hover:bg-admin-bg">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/finance/subcontractors/${s.id}`} className="font-medium text-admin-text hover:underline">{s.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-admin-text-muted">{subcontractorPayTypeLabels[s.payType]}</td>
                  <td className="px-4 py-2.5 text-admin-text-muted">
                    {s.payType === "PERCENTAGE" ? `${s.payRatePercent ?? "—"}%` : s.payType === "HOURLY" ? `${money(s.payRateCents)}/hr` : money(s.payRateCents)}
                  </td>
                  <td className="px-4 py-2.5"><Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status === "ACTIVE" ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-2.5 text-admin-text-muted">{s.phone || s.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewForm && (
        <NewSubcontractorModal
          onClose={() => setShowNewForm(false)}
          onCreated={(s) => {
            setSubcontractors((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
            setShowNewForm(false);
          }}
        />
      )}
    </div>
  );

  function NewSubcontractorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: SubcontractorRow) => void }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [payType, setPayType] = useState<SubcontractorPayType>("PER_JOB");
    const [payRate, setPayRate] = useState("");
    const [payRatePercent, setPayRatePercent] = useState("");
    const [saving, setSaving] = useState(false);

    async function create() {
      if (!name.trim()) return;
      setSaving(true);
      const res = await fetch("/api/admin/finance/subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email: email.trim() || undefined, phone: phone.trim() || undefined, payType,
          payRateCents: payType !== "PERCENTAGE" ? Math.round(Number(payRate || 0) * 100) : undefined,
          payRatePercent: payType === "PERCENTAGE" ? Number(payRatePercent || 0) : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      setSaving(false);
      if (!data?.ok) return showToast(data?.error || "Couldn't create subcontractor", "error");
      showToast("Subcontractor added.", "success");
      onCreated(data.subcontractor);
    }

    return (
      <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-admin-text">New subcontractor</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-admin-text-muted">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              </div>
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-admin-text-muted">Pay type</label>
              <select value={payType} onChange={(e) => setPayType(e.target.value as SubcontractorPayType)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                {SUBCONTRACTOR_PAY_TYPES.map((p) => <option key={p} value={p}>{subcontractorPayTypeLabels[p]}</option>)}
              </select>
            </div>
            {payType === "PERCENTAGE" ? (
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">Percent of job total</label>
                <input type="number" min="1" max="100" value={payRatePercent} onChange={(e) => setPayRatePercent(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-admin-text-muted">{payType === "HOURLY" ? "Rate per hour ($)" : payType === "FLAT_MONTHLY" ? "Flat monthly amount ($)" : "Rate per job ($)"}</label>
                <input type="number" min="0" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              </div>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
            <button type="button" disabled={saving || !name.trim()} onClick={create} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
