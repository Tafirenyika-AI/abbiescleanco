"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, FileSignature } from "lucide-react";
import type { QuoteListItem, QuoteStatusValue } from "@/lib/server/quoteStore";
import { QUOTE_STATUSES } from "@/lib/server/quoteStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { formatCalendarDate } from "@/lib/adminDate";

const statusTone: Record<QuoteStatusValue, "neutral" | "info" | "success" | "error" | "warning"> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "error",
  EXPIRED: "warning",
};

export default function QuotesView({ quotes }: { quotes: QuoteListItem[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatusValue | "ALL">("ALL");

  const filtered = quotes.filter((q) => {
    if (statusFilter !== "ALL" && q.status !== statusFilter) return false;
    if (query.trim() && !`${q.customerName} ${q.quoteNumber}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const sentAwaitingResponse = quotes.filter((q) => q.status === "SENT").length;
  const acceptedValue = quotes.filter((q) => q.status === "ACCEPTED").reduce((sum, q) => sum + q.total, 0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Quotes</h1>
        <p className="mt-1 text-sm text-admin-text-muted">{quotes.length} total</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Awaiting response</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{sentAwaitingResponse}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Accepted value</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${(acceptedValue / 100).toLocaleString("en-US")}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Drafts</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{quotes.filter((q) => q.status === "DRAFT").length}</p>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-admin-border bg-admin-card px-3 py-2">
          <Search className="size-4 text-admin-text-muted" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, quote number…" className="w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none" />
        </div>
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuoteStatusValue | "ALL")} className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-text">
          <option value="ALL">All statuses</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 admin-table-surface overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title={quotes.length === 0 ? "No quotes yet" : "No quotes match your filters"}
            description={quotes.length === 0 ? "Create a quote from a lead's detail panel." : "Try a different search or filter."}
            action={quotes.length === 0 ? <Link href="/admin/leads" className="text-sm font-semibold text-admin-teal-hover hover:underline">Go to leads →</Link> : undefined}
          />
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Quote #</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Customer</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Service</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Total</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Expires</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-t border-admin-border hover:bg-admin-bg/60">
                  <td className="p-3.5"><Link href={`/admin/quotes/${q.id}`} className="font-medium text-admin-text hover:text-admin-teal-hover hover:underline">{q.quoteNumber}</Link></td>
                  <td className="p-3.5 text-admin-text">{q.customerName}</td>
                  <td className="p-3.5 text-admin-text">{q.serviceName}</td>
                  <td className="p-3.5 text-admin-text">${(q.total / 100).toFixed(2)}</td>
                  <td className="p-3.5 text-admin-text-muted">{q.expiresAt ? formatCalendarDate(q.expiresAt) : "—"}</td>
                  <td className="p-3.5"><Badge tone={statusTone[q.status]}>{q.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
