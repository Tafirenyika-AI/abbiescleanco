"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, CalendarClock } from "lucide-react";
import type { BookingListItem, BookingStatusValue } from "@/lib/server/bookingStore";
import { BOOKING_STATUSES, bookingStatusLabels } from "@/lib/server/bookingStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
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

export default function BookingsView({ bookings }: { bookings: BookingListItem[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatusValue | "ALL">("ALL");

  const filtered = bookings.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (query.trim() && !`${b.customerName} ${b.reference} ${b.address}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const [{ now, todayKey }] = useState(() => {
    const n = Date.now();
    return { now: n, todayKey: new Date(n).toDateString() };
  });
  const upcoming = bookings.filter((b) => b.scheduledStart && new Date(b.scheduledStart).getTime() > now && b.status !== "CANCELLED").length;
  const today = bookings.filter((b) => b.scheduledStart && new Date(b.scheduledStart).toDateString() === todayKey).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Bookings</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{bookings.length} total</p>
        </div>
        <Link href="/admin/calendar" className="text-sm font-semibold text-admin-teal-hover hover:underline">View calendar →</Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Today&apos;s jobs</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{today}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-admin-text-muted">Upcoming</p>
          <p className="mt-2 text-2xl font-semibold text-admin-text">{upcoming}</p>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-admin-border bg-admin-card px-3 py-2">
          <Search className="size-4 text-admin-text-muted" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, reference, address…" className="w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none" />
        </div>
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BookingStatusValue | "ALL")} className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-admin-text">
          <option value="ALL">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>{bookingStatusLabels[s]}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 admin-table-surface overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={bookings.length === 0 ? "No bookings yet" : "No bookings match your filters"}
            description={bookings.length === 0 ? "Convert an accepted quote to create your first booking." : "Try a different search or filter."}
            action={bookings.length === 0 ? <Link href="/admin/quotes" className="text-sm font-semibold text-admin-teal-hover hover:underline">Go to quotes →</Link> : undefined}
          />
        ) : (
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Reference</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Customer</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Service</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Address</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Scheduled</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Cleaner</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-admin-border hover:bg-admin-bg/60">
                  <td className="p-3.5"><Link href={`/admin/bookings/${b.id}`} className="font-medium text-admin-text hover:text-admin-teal-hover hover:underline">{b.reference}</Link></td>
                  <td className="p-3.5 text-admin-text">{b.customerName}</td>
                  <td className="p-3.5 text-admin-text">{b.serviceName}</td>
                  <td className="p-3.5 text-admin-text-muted">{b.address}</td>
                  <td className="p-3.5 text-admin-text">{b.scheduledStart ? formatDateTime(b.scheduledStart) : "—"}</td>
                  <td className="p-3.5 text-admin-text-muted">{b.staffAssignee ?? "Unassigned"}</td>
                  <td className="p-3.5"><Badge tone={statusTone[b.status]}>{bookingStatusLabels[b.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
