"use client";

import { useEffect, useState } from "react";
import { Upload, Loader2, Check, X, Undo2, Landmark } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import Badge from "@/components/admin/ui/Badge";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate } from "@/lib/adminDate";
import type { BankTransactionRow, BankSummary } from "@/lib/server/bankStore";

function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unmatched", label: "Unmatched" },
  { key: "matched", label: "Matched" },
  { key: "ignored", label: "Ignored" },
] as const;

export default function BankingManager({ initialTransactions, summary: initialSummary }: { initialTransactions: BankTransactionRow[]; summary: BankSummary }) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [summary, setSummary] = useState(initialSummary);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerKind, setPickerKind] = useState<"PAYMENT" | "EXPENSE">("EXPENSE");
  const [candidates, setCandidates] = useState<{ id: string; label: string }[] | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState("");

  async function refresh(nextFilter = filter) {
    const res = await fetch(`/api/admin/finance/banking/transactions?status=${nextFilter}`);
    const data = await res.json().catch(() => null);
    if (data?.ok) setTransactions(data.transactions);
  }

  useEffect(() => {
    fetch(`/api/admin/finance/banking/transactions?status=${filter}`)
      .then((r) => r.json())
      .then((data) => { if (data?.ok) setTransactions(data.transactions); });
  }, [filter]);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/finance/banking/import", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    setUploading(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't import this file", "error");
    const notes = [
      data.skippedCount > 0 ? `${data.skippedCount} already imported` : null,
      data.unparseableCount > 0 ? `${data.unparseableCount} rows couldn't be read` : null,
    ].filter(Boolean).join(", ");
    showToast(`Imported ${data.importedCount} of ${data.rowCount} rows${notes ? ` (${notes})` : ""}.`, "success");
    await refresh();
    setSummary((s) => ({ ...s, total: s.total + data.importedCount, unmatched: s.unmatched + data.importedCount }));
  }

  async function match(id: string, matchType: "PAYMENT" | "EXPENSE", matchedId: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/finance/banking/transactions/${id}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchType, matchedId }),
    });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't record match", "error");
    showToast("Matched.", "success");
    setPickerFor(null);
    await refresh();
    setSummary((s) => ({ ...s, unmatched: Math.max(0, s.unmatched - 1), matched: s.matched + 1 }));
  }

  async function ignore(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/finance/banking/transactions/${id}/ignore`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't ignore transaction", "error");
    showToast("Marked not a match.", "success");
    await refresh();
    setSummary((s) => ({ ...s, unmatched: Math.max(0, s.unmatched - 1), ignored: s.ignored + 1 }));
  }

  async function undo(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/finance/banking/transactions/${id}/unmatch`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't undo", "error");
    showToast("Reverted to unmatched.", "success");
    await refresh();
    await fetch("/api/admin/finance/banking/transactions?status=all")
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setSummary({ total: d.transactions.length, unmatched: d.transactions.filter((t: BankTransactionRow) => t.status === "UNMATCHED").length, matched: d.transactions.filter((t: BankTransactionRow) => t.status === "MATCHED").length, ignored: d.transactions.filter((t: BankTransactionRow) => t.status === "IGNORED").length }); });
  }

  async function openPicker(id: string, amount: number) {
    setPickerFor(id);
    const kind = amount > 0 ? "PAYMENT" : "EXPENSE";
    setPickerKind(kind);
    setCandidates(null);
    setSelectedCandidate("");
    const res = await fetch(`/api/admin/finance/banking/candidates?kind=${kind}`);
    const data = await res.json().catch(() => null);
    setCandidates(data?.ok ? data.candidates : []);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-admin-text">Banking</h1>
        <p className="mt-1 text-sm text-admin-text-muted">Upload a bank statement CSV and match it against real payments and expenses. Nothing reconciles automatically -- you confirm every match.</p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-admin-text">Import a statement</h2>
        <p className="mt-1 text-xs text-admin-text-muted">CSV with Date, Description, and either an Amount column or separate Debit/Credit columns. Re-uploading the same statement skips rows already imported.</p>
        <label className="ios-press mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} {uploading ? "Importing…" : "Upload CSV"}
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-medium text-admin-text-muted">Total imported</p><p className="mt-1 text-xl font-semibold text-admin-text">{summary.total}</p></Card>
        <Card><p className="text-xs font-medium text-admin-text-muted">Unmatched</p><p className="mt-1 text-xl font-semibold text-admin-text">{summary.unmatched}</p></Card>
        <Card><p className="text-xs font-medium text-admin-text-muted">Matched</p><p className="mt-1 text-xl font-semibold text-admin-text">{summary.matched}</p></Card>
        <Card><p className="text-xs font-medium text-admin-text-muted">Ignored</p><p className="mt-1 text-xl font-semibold text-admin-text">{summary.ignored}</p></Card>
      </div>

      <div className="flex gap-1 rounded-full border border-admin-border bg-admin-card p-1 w-fit">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === f.key ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
        {transactions.length === 0 ? (
          <EmptyState icon={Landmark} title="No transactions" description="Upload a bank statement CSV above to get started." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Match</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-admin-border">
                  <td className="px-4 py-2.5 text-admin-text-muted">{formatDate(t.date)}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-admin-text">{t.description}</td>
                  <td className={`px-4 py-2.5 font-medium ${t.amount < 0 ? "text-admin-text" : "text-admin-success"}`}>{money(t.amount)}</td>
                  <td className="px-4 py-2.5">
                    {t.status === "MATCHED" && <Badge tone="success">{t.matchedLabel}</Badge>}
                    {t.status === "IGNORED" && <Badge tone="neutral">Not a match{t.matchedByName ? ` · ${t.matchedByName}` : ""}</Badge>}
                    {t.status === "UNMATCHED" && t.suggestion && (
                      <span className="text-xs text-admin-text-muted">Looks like <strong className="font-semibold text-admin-text">{t.suggestion.label}</strong></span>
                    )}
                    {t.status === "UNMATCHED" && !t.suggestion && <span className="text-xs text-admin-text-muted">No suggestion</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.status === "UNMATCHED" && t.suggestion && (
                      <div className="flex gap-1.5">
                        <button type="button" disabled={busyId === t.id} onClick={() => match(t.id, t.suggestion!.type, t.suggestion!.id)} className="ios-press inline-flex items-center gap-1 rounded-full bg-admin-success/10 px-2.5 py-1 text-xs font-semibold text-admin-success hover:bg-admin-success/20 disabled:opacity-50">
                          <Check className="size-3.5" aria-hidden /> Match
                        </button>
                        <button type="button" disabled={busyId === t.id} onClick={() => ignore(t.id)} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                          <X className="size-3.5" aria-hidden /> Not a match
                        </button>
                      </div>
                    )}
                    {t.status === "UNMATCHED" && !t.suggestion && (
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => openPicker(t.id, t.amount)} className="ios-press rounded-full bg-admin-bg px-2.5 py-1 text-xs font-semibold text-admin-text hover:bg-admin-border">Pick match…</button>
                        <button type="button" disabled={busyId === t.id} onClick={() => ignore(t.id)} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                          <X className="size-3.5" aria-hidden /> Not a match
                        </button>
                      </div>
                    )}
                    {(t.status === "MATCHED" || t.status === "IGNORED") && (
                      <button type="button" disabled={busyId === t.id} onClick={() => undo(t.id)} className="ios-press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                        <Undo2 className="size-3.5" aria-hidden /> Undo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pickerFor && (
        <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setPickerFor(null)}>
          <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-admin-text">Pick a match</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Showing recent unmatched {pickerKind === "PAYMENT" ? "payments" : "expenses"}.</p>
            {candidates === null ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-admin-text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading…</p>
            ) : candidates.length === 0 ? (
              <p className="mt-4 text-sm text-admin-text-muted">No unmatched {pickerKind === "PAYMENT" ? "payments" : "expenses"} found.</p>
            ) : (
              <select value={selectedCandidate} onChange={(e) => setSelectedCandidate(e.target.value)} className="mt-3 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                <option value="">Select…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPickerFor(null)} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
              <button type="button" disabled={!selectedCandidate || busyId === pickerFor} onClick={() => match(pickerFor, pickerKind, selectedCandidate)} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
