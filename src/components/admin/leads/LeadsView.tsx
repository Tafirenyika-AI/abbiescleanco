"use client";

import { useMemo, useState } from "react";
import { Search, Inbox, Clock, TrendingUp, DollarSign } from "lucide-react";
import { LEAD_STATUSES, leadStatusLabels, type StoredLead, type LeadStatusValue } from "@/lib/leads";
import { services } from "@/lib/data/services";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import LeadDetailDrawer from "./LeadDetailDrawer";

function statusTone(status: LeadStatusValue) {
  if (status === "LOST" || status === "CANCELLED") return "error" as const;
  if (status === "COMPLETED" || status === "CONFIRMED" || status === "SCHEDULED") return "success" as const;
  if (status === "NEW") return "info" as const;
  return "warning" as const;
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const openPipelineStatuses: LeadStatusValue[] = ["NEW", "CONTACTED", "ESTIMATE_SENT", "AWAITING_CUSTOMER"];

export default function LeadsView({ initialLeads }: { initialLeads: StoredLead[] }) {
  const { showToast } = useToast();
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatusValue | "ALL">("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<LeadStatusValue | "">("");
  const [confirmBulk, setConfirmBulk] = useState(false);

  const serviceOptions = useMemo(() => {
    const ids = new Set(leads.map((l) => l.input.service));
    return [...ids].map((id) => ({ id, name: services.find((s) => s.id === id)?.name ?? id }));
  }, [leads]);

  const filtered = leads.filter((lead) => {
    if (statusFilter !== "ALL" && lead.status !== statusFilter) return false;
    if (serviceFilter !== "ALL" && lead.input.service !== serviceFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = `${lead.input.firstName} ${lead.input.lastName} ${lead.input.email} ${lead.input.phone} ${lead.reference}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const newCount = leads.filter((l) => l.status === "NEW").length;
  const followUpCount = leads.filter((l) => openPipelineStatuses.includes(l.status)).length;
  const manualQuoteCount = leads.filter((l) => l.estimate.requiresManualQuote).length;
  const pipelineValue = leads
    .filter((l) => openPipelineStatuses.includes(l.status) && !l.estimate.requiresManualQuote)
    .reduce((sum, l) => sum + (l.estimate.totalLow + l.estimate.totalHigh) / 2, 0);

  const pipelineCounts = LEAD_STATUSES.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  })).filter((s) => s.status !== "CANCELLED");

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((l) => l.id))));
  }

  function updateLeadInList(updated: StoredLead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  async function applyBulkStatus() {
    if (!bulkStatus) return;
    const ids = [...selected];
    const res = await fetch("/api/admin/leads/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status: bulkStatus }),
    });
    const json = await res.json();
    setConfirmBulk(false);
    if (!res.ok || !json.ok) {
      showToast(json.error || "Bulk update failed", "error");
      return;
    }
    setLeads((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, status: bulkStatus as LeadStatusValue } : l)));
    setSelected(new Set());
    setBulkStatus("");
    showToast(`Updated ${json.updated} lead${json.updated === 1 ? "" : "s"}`, "success");
  }

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Leads</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{leads.length} total</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">New leads</p>
            <Inbox className="size-4 text-admin-teal-hover" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{newCount}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">Needing follow-up</p>
            <Clock className="size-4 text-admin-teal-hover" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{followUpCount}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">Manual-quote requests</p>
            <TrendingUp className="size-4 text-admin-teal-hover" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{manualQuoteCount}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-admin-text-muted">Estimated pipeline value</p>
            <DollarSign className="size-4 text-admin-teal-hover" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${Math.round(pipelineValue).toLocaleString()}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap gap-2">
          {pipelineCounts.map(({ status, count }) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? "ALL" : status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === status ? "border-admin-teal bg-admin-teal/10 text-admin-teal-hover" : "border-admin-border text-admin-text-muted hover:bg-admin-bg"
              }`}
            >
              {leadStatusLabels[status]} <span className="ml-1 text-admin-text">{count}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-admin-border bg-admin-card px-3 py-2">
          <Search className="size-4 text-admin-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, reference…"
            className="w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatusValue | "ALL")} className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-text">
          <option value="ALL">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{leadStatusLabels[s]}</option>
          ))}
        </select>
        <select aria-label="Filter by service" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-text">
          <option value="ALL">All services</option>
          {serviceOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-admin-teal/30 bg-admin-teal/5 px-4 py-2.5">
          <p className="text-sm font-semibold text-admin-teal-hover">{selected.size} selected</p>
          <select aria-label="Bulk set status" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as LeadStatusValue)} className="rounded-lg border border-admin-border bg-admin-card px-2.5 py-1.5 text-sm text-admin-text">
            <option value="">Set status…</option>
            {LEAD_STATUSES.filter((s) => s !== "LOST").map((s) => (
              <option key={s} value={s}>{leadStatusLabels[s]}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!bulkStatus}
            onClick={() => setConfirmBulk(true)}
            className="rounded-lg bg-admin-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-50"
          >
            Apply
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-admin-text-muted hover:underline">
            Clear
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={leads.length === 0 ? "No leads yet" : "No leads match your filters"}
            description={leads.length === 0 ? "New quote and contact requests will appear here." : "Try a different search or filter."}
            action={
              leads.length === 0 ? (
                <a href="/estimate" className="text-sm font-semibold text-admin-teal-hover hover:underline">View public quote form →</a>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="w-10 p-3.5">
                  <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} aria-label="Select all" />
                </th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Reference</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Customer</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Service</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Property</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Estimate</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Source</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Status</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="cursor-pointer border-t border-admin-border hover:bg-admin-bg/60" onClick={() => setOpenLeadId(lead.id)}>
                  <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelected(lead.id)} aria-label={`Select ${lead.reference}`} />
                  </td>
                  <td className="p-3.5 font-medium text-admin-text">{lead.reference}</td>
                  <td className="p-3.5 text-admin-text">
                    {lead.input.firstName} {lead.input.lastName}
                    <div className="text-xs text-admin-text-muted">{lead.input.email}</div>
                  </td>
                  <td className="p-3.5 text-admin-text">{services.find((s) => s.id === lead.input.service)?.name ?? lead.input.service}</td>
                  <td className="p-3.5 text-admin-text">{lead.input.zip || "—"}</td>
                  <td className="p-3.5 text-admin-text">
                    {lead.estimate.requiresManualQuote ? "Manual quote" : `$${lead.estimate.totalLow}–$${lead.estimate.totalHigh}`}
                  </td>
                  <td className="p-3.5 capitalize text-admin-text">{lead.source}</td>
                  <td className="p-3.5">
                    <Badge tone={statusTone(lead.status)}>{leadStatusLabels[lead.status]}</Badge>
                  </td>
                  <td className="p-3.5 text-admin-text-muted">{relativeTime(lead.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openLead && (
        <LeadDetailDrawer
          lead={openLead}
          onClose={() => setOpenLeadId(null)}
          onUpdated={updateLeadInList}
        />
      )}

      <ConfirmDialog
        open={confirmBulk}
        title={`Update ${selected.size} lead${selected.size === 1 ? "" : "s"}?`}
        description={`Set status to "${bulkStatus ? leadStatusLabels[bulkStatus as LeadStatusValue] : ""}".`}
        confirmLabel="Update"
        onConfirm={applyBulkStatus}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
