"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BookingListItem } from "@/lib/server/bookingStore";
import type { BookingStatusValue } from "@/lib/bookings";
import { bookingStatusLabels } from "@/lib/bookings";
import { pacificWallTimeToUtc } from "@/lib/adminDate";
import { useToast } from "@/components/admin/ui/Toast";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import {
  businessDayKey,
  businessTimeLabel,
  businessMinutesOfDay,
  parseDateKey,
  toDateKey,
  addDays,
  startOfWeek,
  shortDayLabel,
  todayKey,
} from "@/lib/calendarDates";

const statusTone: Record<BookingStatusValue, "neutral" | "info" | "success" | "error" | "warning" | "teal"> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  SCHEDULED: "info",
  ON_THE_WAY: "teal",
  IN_PROGRESS: "teal",
  COMPLETED: "success",
  CANCELLED: "error",
  RESCHEDULED: "warning",
};

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 20;
const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
const HOUR_PX = 52;
const GRID_PX = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_PX;
const SNAP_MINUTES = 30;

type ViewMode = "month" | "week" | "day";

export default function CalendarBoard({
  bookings,
  teamMembers,
  view,
  anchorDate,
  resourceView,
}: {
  bookings: BookingListItem[];
  teamMembers: { id: string; name: string }[];
  view: ViewMode;
  anchorDate: string;
  resourceView: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<string, BookingListItem[]>();
    for (const b of bookings) {
      if (!b.scheduledStart) continue;
      const key = businessDayKey(b.scheduledStart);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [bookings]);

  const today = todayKey();

  async function moveToDate(bookingId: string, newDateKey: string) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || !booking.scheduledStart) return;
    const { year, month, day } = parseDateKey(newDateKey);
    const origStart = new Date(booking.scheduledStart);
    const origEnd = booking.scheduledEnd ? new Date(booking.scheduledEnd) : new Date(origStart.getTime() + 2 * 60 * 60 * 1000);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const startMinutes = businessMinutesOfDay(booking.scheduledStart);
    const newStart = pacificWallTimeToUtc(year, month, day, Math.floor(startMinutes / 60), startMinutes % 60);
    const newEnd = new Date(newStart.getTime() + durationMs);
    await applyReschedule(bookingId, newStart, newEnd);
  }

  async function moveToTime(bookingId: string, newDateKey: string, minutesFromMidnight: number, newStaff?: string) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || !booking.scheduledStart) return;
    const { year, month, day } = parseDateKey(newDateKey);
    const origStart = new Date(booking.scheduledStart);
    const origEnd = booking.scheduledEnd ? new Date(booking.scheduledEnd) : new Date(origStart.getTime() + 2 * 60 * 60 * 1000);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const snapped = Math.round(minutesFromMidnight / SNAP_MINUTES) * SNAP_MINUTES;
    const newStart = pacificWallTimeToUtc(year, month, day, Math.floor(snapped / 60), snapped % 60);
    const newEnd = new Date(newStart.getTime() + durationMs);
    await applyReschedule(bookingId, newStart, newEnd, newStaff);
  }

  async function applyReschedule(bookingId: string, newStart: Date, newEnd: Date, newStaff?: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/bookings/${bookingId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStart: newStart.toISOString(), scheduledEnd: newEnd.toISOString() }),
    });
    if (res.status === 409) {
      setBusy(false);
      showToast("That time conflicts with another booking -- open the booking to override if you're sure.", "error");
      return;
    }
    if (!res.ok) {
      setBusy(false);
      showToast("Couldn't move that booking", "error");
      return;
    }
    if (newStaff !== undefined) {
      await fetch(`/api/admin/bookings/${bookingId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffAssignee: newStaff }),
      });
    }
    setBusy(false);
    showToast("Booking moved", "success");
    router.refresh();
  }

  function onDragStartChip(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }
  function onDragEndChip() {
    setDraggingId(null);
  }

  if (view === "month") {
    return <MonthGrid anchorDate={anchorDate} byDay={byDay} today={today} draggingId={draggingId} busy={busy} onDragStartChip={onDragStartChip} onDragEndChip={onDragEndChip} onDropDay={moveToDate} />;
  }

  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchorDate), i)) : [anchorDate];

  if (view === "day" && resourceView) {
    return (
      <ResourceDayGrid
        dateKey={anchorDate}
        bookings={byDay.get(anchorDate) ?? []}
        teamMembers={teamMembers}
        draggingId={draggingId}
        busy={busy}
        onDragStartChip={onDragStartChip}
        onDragEndChip={onDragEndChip}
        onDropSlot={moveToTime}
      />
    );
  }

  return (
    <TimeGrid
      days={days}
      byDay={byDay}
      today={today}
      draggingId={draggingId}
      busy={busy}
      onDragStartChip={onDragStartChip}
      onDragEndChip={onDragEndChip}
      onDropSlot={(dateKey, minutes) => draggingId && moveToTime(draggingId, dateKey, minutes)}
    />
  );
}

function BookingChip({ b, draggable, onDragStart, onDragEnd, compact }: { b: BookingListItem; draggable: boolean; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; compact?: boolean }) {
  return (
    <Link
      href={`/admin/bookings/${b.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white hover:opacity-90 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ backgroundColor: "var(--color-admin-teal)" }}
      title={`${b.customerName}, ${bookingStatusLabels[b.status]}${b.staffAssignee ? `, ${b.staffAssignee}` : ""}`}
    >
      {!compact && b.scheduledStart && `${businessTimeLabel(b.scheduledStart)} `}{b.customerName}
    </Link>
  );
}

// ---------------- Month view ----------------

function MonthGrid({
  anchorDate,
  byDay,
  today,
  draggingId,
  busy,
  onDragStartChip,
  onDragEndChip,
  onDropDay,
}: {
  anchorDate: string;
  byDay: Map<string, BookingListItem[]>;
  today: string;
  draggingId: string | null;
  busy: boolean;
  onDragStartChip: (e: React.DragEvent, id: string) => void;
  onDragEndChip: () => void;
  onDropDay: (bookingId: string, dateKey: string) => void;
}) {
  const { year, month } = parseDateKey(anchorDate);
  const firstOfMonth = toDateKey(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));

  return (
    <Card padded={false}>
      <div className="grid grid-cols-7 border-b border-admin-border text-center text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="p-2.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((key) => {
          const { month: cellMonth, day } = parseDateKey(key);
          const inMonth = cellMonth === month;
          const dayBookings = byDay.get(key) ?? [];
          const isToday = key === today;
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                if (id && !busy) onDropDay(id, key);
              }}
              className={`min-h-[110px] border-b border-r border-admin-border p-1.5 last:border-r-0 ${inMonth ? "bg-admin-card" : "bg-admin-bg/40"}`}
            >
              <p className={`text-xs font-semibold ${isToday ? "flex size-5 items-center justify-center rounded-full bg-admin-teal text-white" : inMonth ? "text-admin-text" : "text-admin-text-muted"}`}>{day}</p>
              <div className="mt-1 space-y-1">
                {dayBookings.slice(0, 3).map((b) => (
                  <div key={b.id} className={draggingId === b.id ? "opacity-40" : ""}>
                    <BookingChip b={b} draggable onDragStart={(e) => onDragStartChip(e, b.id)} onDragEnd={onDragEndChip} />
                  </div>
                ))}
                {dayBookings.length > 3 && <p className="text-[10px] text-admin-text-muted">+{dayBookings.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------- Week/Day time grid ----------------

function HourRail() {
  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
  return (
    <div className="relative shrink-0" style={{ width: 52 }}>
      <div style={{ height: 24 }} />
      {hours.map((h) => (
        <div key={h} style={{ height: HOUR_PX }} className="-mt-2 text-right text-[10px] text-admin-text-muted">
          {((h + 11) % 12) + 1}{h < 12 ? "am" : "pm"}
        </div>
      ))}
    </div>
  );
}

function EventBlock({ b, draggingId, onDragStartChip, onDragEndChip }: { b: BookingListItem; draggingId: string | null; onDragStartChip: (e: React.DragEvent, id: string) => void; onDragEndChip: () => void }) {
  if (!b.scheduledStart) return null;
  const startMin = Math.max(businessMinutesOfDay(b.scheduledStart) - GRID_START_HOUR * 60, 0);
  const endMin = b.scheduledEnd ? businessMinutesOfDay(b.scheduledEnd) - GRID_START_HOUR * 60 : startMin + 60;
  const top = (startMin / GRID_MINUTES) * GRID_PX;
  const height = Math.max(((endMin - startMin) / GRID_MINUTES) * GRID_PX, 20);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStartChip(e, b.id)}
      onDragEnd={onDragEndChip}
      style={{ position: "absolute", top, height, left: 2, right: 2 }}
      className={draggingId === b.id ? "opacity-40" : ""}
    >
      <Link
        href={`/admin/bookings/${b.id}`}
        className="block h-full cursor-grab overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white active:cursor-grabbing"
        style={{ backgroundColor: "var(--color-admin-teal)" }}
        title={`${b.customerName}, ${bookingStatusLabels[b.status]}`}
      >
        <span className="font-semibold">{businessTimeLabel(b.scheduledStart)}</span> {b.customerName}
      </Link>
    </div>
  );
}

function GridColumn({
  dateKey,
  label,
  isToday,
  bookings,
  draggingId,
  busy,
  onDragStartChip,
  onDragEndChip,
  onDropSlot,
}: {
  dateKey: string;
  label: React.ReactNode;
  isToday: boolean;
  bookings: BookingListItem[];
  draggingId: string | null;
  busy: boolean;
  onDragStartChip: (e: React.DragEvent, id: string) => void;
  onDragEndChip: () => void;
  onDropSlot: (dateKey: string, minutesFromMidnight: number) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex-1 border-r border-admin-border last:border-r-0">
      <div className={`flex h-6 items-center justify-center border-b border-admin-border text-xs font-semibold ${isToday ? "text-admin-teal-hover" : "text-admin-text"}`}>{label}</div>
      <div
        ref={colRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (busy || !colRef.current) return;
          const id = e.dataTransfer.getData("text/plain") || draggingId;
          if (!id) return;
          const rect = colRef.current.getBoundingClientRect();
          const offsetY = e.clientY - rect.top;
          const minutes = GRID_START_HOUR * 60 + (offsetY / GRID_PX) * GRID_MINUTES;
          onDropSlot(dateKey, Math.max(0, Math.min(GRID_MINUTES + GRID_START_HOUR * 60 - 1, minutes)));
        }}
        style={{ height: GRID_PX, position: "relative" }}
        className={`bg-admin-card ${isToday ? "bg-admin-teal/5" : ""}`}
      >
        {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
          <div key={i} style={{ position: "absolute", top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX }} className="border-b border-admin-border/50" />
        ))}
        {bookings.map((b) => (
          <EventBlock key={b.id} b={b} draggingId={draggingId} onDragStartChip={onDragStartChip} onDragEndChip={onDragEndChip} />
        ))}
      </div>
    </div>
  );
}

function TimeGrid({
  days,
  byDay,
  today,
  draggingId,
  busy,
  onDragStartChip,
  onDragEndChip,
  onDropSlot,
}: {
  days: string[];
  byDay: Map<string, BookingListItem[]>;
  today: string;
  draggingId: string | null;
  busy: boolean;
  onDragStartChip: (e: React.DragEvent, id: string) => void;
  onDragEndChip: () => void;
  onDropSlot: (dateKey: string, minutesFromMidnight: number) => void;
}) {
  return (
    <Card padded={false}>
      <div className="flex overflow-x-auto">
        <HourRail />
        {days.map((key) => {
          const { weekday, day } = shortDayLabel(key);
          return (
            <GridColumn
              key={key}
              dateKey={key}
              label={<span>{weekday} {day}</span>}
              isToday={key === today}
              bookings={byDay.get(key) ?? []}
              draggingId={draggingId}
              busy={busy}
              onDragStartChip={onDragStartChip}
              onDragEndChip={onDragEndChip}
              onDropSlot={onDropSlot}
            />
          );
        })}
      </div>
    </Card>
  );
}

// ---------------- Day resource (per-cleaner) view ----------------

function ResourceDayGrid({
  dateKey,
  bookings,
  teamMembers,
  draggingId,
  busy,
  onDragStartChip,
  onDragEndChip,
  onDropSlot,
}: {
  dateKey: string;
  bookings: BookingListItem[];
  teamMembers: { id: string; name: string }[];
  draggingId: string | null;
  busy: boolean;
  onDragStartChip: (e: React.DragEvent, id: string) => void;
  onDragEndChip: () => void;
  onDropSlot: (bookingId: string, dateKey: string, minutesFromMidnight: number, newStaff?: string) => void;
}) {
  const columns = [...teamMembers.map((m) => m.name), "Unassigned"];
  const byPerson = new Map<string, BookingListItem[]>();
  for (const name of columns) byPerson.set(name, []);
  for (const b of bookings) {
    const key = b.staffAssignee && columns.includes(b.staffAssignee) ? b.staffAssignee : "Unassigned";
    byPerson.get(key)!.push(b);
  }

  return (
    <Card padded={false}>
      <div className="flex overflow-x-auto">
        <HourRail />
        {columns.map((name) => (
          <div key={name} className="flex-1 border-r border-admin-border last:border-r-0" style={{ minWidth: 140 }}>
            <div className="flex h-6 items-center justify-center border-b border-admin-border text-xs font-semibold text-admin-text">{name}</div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (busy) return;
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                if (!id) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const minutes = GRID_START_HOUR * 60 + (offsetY / GRID_PX) * GRID_MINUTES;
                onDropSlot(id, dateKey, minutes, name === "Unassigned" ? "" : name);
              }}
              style={{ height: GRID_PX, position: "relative" }}
              className="bg-admin-card"
            >
              {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => (
                <div key={i} style={{ position: "absolute", top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX }} className="border-b border-admin-border/50" />
              ))}
              {(byPerson.get(name) ?? []).map((b) => (
                <EventBlock key={b.id} b={b} draggingId={draggingId} onDragStartChip={onDragStartChip} onDragEndChip={onDragEndChip} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StatusLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {Object.entries(bookingStatusLabels).map(([status, label]) => (
        <Badge key={status} tone={statusTone[status as BookingStatusValue]}>{label}</Badge>
      ))}
    </div>
  );
}
