"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, UserSquare2 } from "lucide-react";
import type { CustomerSummary } from "@/lib/server/customerStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";

const statusTone = { active: "success", lead: "info", new: "neutral" } as const;
const statusLabel = { active: "Active", lead: "Lead", new: "New" } as const;

export default function CustomersView({ customers }: { customers: CustomerSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = customers.filter((c) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q);
  });

  const activeCount = customers.filter((c) => c.status === "active").length;
  const lifetimeTotal = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Customers</h1>
        <p className="mt-1 text-sm text-admin-text-muted">{customers.length} total</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Total customers</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{customers.length}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Active (has a booking)</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Lifetime revenue (paid)</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">${lifetimeTotal.toLocaleString("en-US")}</p>
        </Card>
      </div>

      <div className="mt-4 flex min-w-[220px] max-w-md items-center gap-2 rounded-lg border border-admin-border bg-admin-card px-3 py-2">
        <Search className="size-4 text-admin-text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone…"
          className="w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={UserSquare2}
            title={customers.length === 0 ? "No customers yet" : "No customers match your search"}
            description={customers.length === 0 ? "Customers appear here once a lead is submitted or an account is created." : "Try a different search."}
          />
        ) : (
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Name</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Contact</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Primary address</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Bookings</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Lifetime value</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Outstanding</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-admin-border hover:bg-admin-bg/60">
                  <td className="p-3.5">
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-admin-text hover:text-admin-teal-hover hover:underline">
                      {c.name || "—"}
                    </Link>
                  </td>
                  <td className="p-3.5 text-admin-text">
                    {c.email}
                    <div className="text-xs text-admin-text-muted">{c.phone}</div>
                  </td>
                  <td className="p-3.5 text-admin-text">{c.primaryAddress ?? "—"}</td>
                  <td className="p-3.5 text-admin-text">{c.totalBookings}</td>
                  <td className="p-3.5 text-admin-text">${c.lifetimeValue.toLocaleString("en-US")}</td>
                  <td className="p-3.5 text-admin-text">{c.outstandingBalance > 0 ? `$${c.outstandingBalance.toLocaleString("en-US")}` : "—"}</td>
                  <td className="p-3.5"><Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
