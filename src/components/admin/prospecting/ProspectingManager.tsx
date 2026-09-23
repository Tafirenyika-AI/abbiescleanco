"use client";

import { useState } from "react";
import { Search, Loader2, X, Mail, Send, Ban, Sparkles } from "lucide-react";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import {
  type ProspectRow,
  type ProspectCategory,
  type ProspectStatus,
  PROSPECT_CATEGORIES,
  PROSPECT_STATUSES,
  prospectCategoryLabels,
  prospectStatusLabels,
} from "@/lib/prospects";

function statusTone(status: ProspectStatus): "neutral" | "teal" | "success" | "warning" | "error" | "info" {
  if (status === "DO_NOT_CONTACT" || status === "REJECTED") return "error";
  if (status === "SENT" || status === "REPLIED") return "info";
  if (status === "CONVERTED") return "success";
  if (status === "DRAFTED" || status === "APPROVED") return "warning";
  return "neutral";
}

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
}

export default function ProspectingManager({ initialProspects, placesConfigured }: { initialProspects: ProspectRow[]; placesConfigured: boolean }) {
  const { showToast } = useToast();
  const [prospects, setProspects] = useState(initialProspects);
  const [selected, setSelected] = useState<ProspectRow | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProspectCategory>("LOCAL_BUSINESS");
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "">("");

  async function refresh() {
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    const res = await fetch(`/api/admin/prospecting${qs}`);
    const data = await res.json().catch(() => null);
    if (data?.ok) setProspects(data.prospects);
  }

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch("/api/admin/prospecting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, category }),
    });
    const data = await res.json().catch(() => null);
    setSearching(false);
    if (!data?.ok) return showToast(data?.error || "Search failed", "error");
    showToast(`Found ${data.found} — ${data.new} new, ${data.duplicates} already known.`, "success");
    await refresh();
  }

  const filtered = statusFilter ? prospects.filter((p) => p.status === statusFilter) : prospects;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-admin-text">Prospecting</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          Find potential customers — property managers, realtors, local businesses — and reach out. Every message is drafted for your review; nothing sends without you clicking Send.
        </p>
      </div>

      {!placesConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Google Places search isn&apos;t configured yet — add a Google Maps API key in <span className="font-semibold">Settings → Integrations</span> to search for real businesses. You can still view/manage prospects added manually.
        </div>
      )}

      <div className="rounded-xl border border-admin-border bg-admin-card p-4">
        <h2 className="text-sm font-semibold text-admin-text">Find new prospects</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value as ProspectCategory)} className="rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text">
            {PROSPECT_CATEGORIES.filter((c) => c !== "HOMEOWNER").map((c) => (
              <option key={c} value={c}>{prospectCategoryLabels[c]}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder='e.g. "property management Spokane Valley WA"'
            className="min-w-64 flex-1 rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text"
          />
          <button type="button" onClick={search} disabled={searching || !query.trim()} className="ios-press inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />} Search
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ProspectStatus | ""); }}
          className="rounded-lg border border-admin-border bg-admin-card px-3 py-1.5 text-sm text-admin-text"
        >
          <option value="">All statuses</option>
          {PROSPECT_STATUSES.map((s) => (
            <option key={s} value={s}>{prospectStatusLabels[s]}</option>
          ))}
        </select>
        <span className="text-xs text-admin-text-muted">{filtered.length} prospect{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No prospects yet" description="Search above to find property managers, realtors, or local businesses in your service area." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-admin-border bg-admin-card">
          <table className="w-full text-sm">
            <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
              <tr>
                <th className="px-4 py-2.5">Business / contact</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Contact info</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Discovered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p)} className="cursor-pointer border-t border-admin-border transition-colors duration-150 hover:bg-admin-bg">
                  <td className="px-4 py-2.5 font-medium text-admin-text">{p.businessName || p.contactName || "Unnamed"}</td>
                  <td className="px-4 py-2.5 text-admin-text-muted">{prospectCategoryLabels[p.category]}</td>
                  <td className="px-4 py-2.5 text-admin-text-muted">{p.phone || p.email || "—"}</td>
                  <td className="px-4 py-2.5"><Badge tone={statusTone(p.status)}>{prospectStatusLabels[p.status]}</Badge></td>
                  <td className="px-4 py-2.5 text-admin-text-muted">{when(p.discoveredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          onClose={() => setSelected(null)}
          onUpdated={(p) => {
            setSelected(p);
            setProspects((prev) => prev.map((x) => (x.id === p.id ? p : x)));
          }}
        />
      )}
    </div>
  );
}

function ProspectDrawer({ prospect, onClose, onUpdated }: { prospect: ProspectRow; onClose: () => void; onUpdated: (p: ProspectRow) => void }) {
  const { showToast } = useToast();
  const [subject, setSubject] = useState(prospect.draftSubject || "");
  const [body, setBody] = useState(prospect.draftBody || "");
  const [notes, setNotes] = useState(prospect.notes || "");
  const [busy, setBusy] = useState<string | null>(null);

  async function draft() {
    setBusy("draft");
    const res = await fetch(`/api/admin/prospecting/${prospect.id}/draft`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't draft a message", "error");
    setSubject(data.prospect.draftSubject || "");
    setBody(data.prospect.draftBody || "");
    onUpdated(data.prospect);
    showToast("Draft ready — review before sending.", "success");
  }

  async function saveDraft() {
    setBusy("save");
    const res = await fetch(`/api/admin/prospecting/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftSubject: subject, draftBody: body, notes }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't save", "error");
    onUpdated(data.prospect);
    showToast("Saved.", "success");
  }

  async function send() {
    setBusy("send");
    await saveDraft();
    const res = await fetch(`/api/admin/prospecting/${prospect.id}/send`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!data?.ok) return showToast(data?.error || "Send failed", "error");
    showToast(`Sent to ${prospect.email}.`, "success");
    const refreshed = await fetch(`/api/admin/prospecting/${prospect.id}`).then((r) => r.json());
    if (refreshed?.ok) onUpdated(refreshed.prospect);
  }

  async function setStatus(status: ProspectStatus) {
    setBusy(status);
    const res = await fetch(`/api/admin/prospecting/${prospect.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't update", "error");
    onUpdated(data.prospect);
    showToast(`Marked ${prospectStatusLabels[status]}.`, "success");
  }

  return (
    <div className="ios-backdrop-in fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-drawer-in h-full w-full max-w-lg overflow-y-auto bg-admin-card p-6 shadow-[-8px_0_40px_rgba(15,23,42,0.12)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-admin-text-muted">{prospectCategoryLabels[prospect.category]}</p>
            <h2 className="text-lg font-semibold text-admin-text">{prospect.businessName || prospect.contactName || "Unnamed prospect"}</h2>
            <Badge tone={statusTone(prospect.status)} className="mt-1">{prospectStatusLabels[prospect.status]}</Badge>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ios-press rounded-lg p-1.5 text-admin-text-muted hover:bg-admin-bg"><X className="size-5" aria-hidden /></button>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm">
          {prospect.address && <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Address</dt><dd className="text-right text-admin-text">{prospect.address}</dd></div>}
          {prospect.phone && <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Phone</dt><dd className="text-admin-text">{prospect.phone}</dd></div>}
          {prospect.email && <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Email</dt><dd className="text-admin-text">{prospect.email}</dd></div>}
          {prospect.website && <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Website</dt><dd className="truncate text-admin-text">{prospect.website}</dd></div>}
          {!prospect.email && <p className="text-xs text-amber-700">No email on file — outreach can&apos;t be sent until one is added.</p>}
        </dl>

        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Outreach draft</h3>
          <p className="mt-1 text-xs text-admin-text-muted">This is exactly what will be sent — edit freely before sending.</p>
          <button type="button" onClick={draft} disabled={busy === "draft"} className="ios-press mt-2 inline-flex items-center gap-1.5 rounded-full bg-admin-bg px-3 py-1.5 text-xs font-semibold text-admin-text disabled:opacity-50">
            {busy === "draft" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />} {subject ? "Regenerate draft" : "Generate draft"}
          </button>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="mt-2 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Message body" className="mt-2 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text" />
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Notes</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes" className="mt-2 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={saveDraft} disabled={!!busy} className="ios-press rounded-full bg-admin-bg px-4 py-2 text-sm font-semibold text-admin-text disabled:opacity-50">Save</button>
          <button
            type="button"
            onClick={send}
            disabled={!!busy || !prospect.email || !subject || !body || prospect.status === "DO_NOT_CONTACT"}
            className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "send" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Send
          </button>
          {prospect.status !== "DO_NOT_CONTACT" && (
            <button type="button" onClick={() => setStatus("DO_NOT_CONTACT")} disabled={!!busy} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
              <Ban className="size-4" aria-hidden /> Do not contact
            </button>
          )}
        </div>

        {prospect.status === "SENT" && (
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setStatus("REPLIED")} disabled={!!busy} className="ios-press rounded-full bg-admin-bg px-3 py-1.5 text-xs font-semibold text-admin-text disabled:opacity-50">Mark replied</button>
            <button type="button" onClick={() => setStatus("CONVERTED")} disabled={!!busy} className="ios-press rounded-full bg-admin-bg px-3 py-1.5 text-xs font-semibold text-admin-text disabled:opacity-50">Mark converted</button>
          </div>
        )}

        <p className="mt-6 flex items-start gap-1.5 text-xs text-admin-text-muted"><Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Outreach is only ever sent by you clicking Send — nothing here contacts anyone automatically.</p>
      </div>
    </div>
  );
}
