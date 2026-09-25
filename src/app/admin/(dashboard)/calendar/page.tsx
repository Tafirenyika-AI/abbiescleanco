import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Columns3 } from "lucide-react";
import { listBookingsInRange } from "@/lib/server/bookingStore";
import { listTeamMembers } from "@/lib/server/teamStore";
import CalendarBoard, { StatusLegend } from "@/components/admin/calendar/CalendarBoard";
import Card from "@/components/admin/ui/Card";
import {
  parseDateKey,
  toDateKey,
  addDays,
  startOfWeek,
  monthLabel,
  dayLabel,
  todayKey,
} from "@/lib/calendarDates";

type ViewMode = "month" | "week" | "day";

function rangeFor(view: ViewMode, anchorDate: string): { start: string; end: string } {
  const { year, month } = parseDateKey(anchorDate);
  if (view === "day") {
    return { start: `${anchorDate}T00:00:00.000Z`, end: `${anchorDate}T23:59:59.999Z` };
  }
  if (view === "week") {
    const weekStart = startOfWeek(anchorDate);
    const weekEnd = addDays(weekStart, 6);
    return { start: `${weekStart}T00:00:00.000Z`, end: `${weekEnd}T23:59:59.999Z` };
  }
  // month: full 6-week grid, same as before
  const firstOfMonth = toDateKey(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const gridEnd = addDays(gridStart, totalCells - 1);
  return { start: `${gridStart}T00:00:00.000Z`, end: `${gridEnd}T23:59:59.999Z` };
}

function navHref(view: ViewMode, date: string, resource: boolean) {
  return `/admin/calendar?view=${view}&date=${date}${resource ? "&resource=1" : ""}`;
}

export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; resource?: string }> }) {
  const { view: viewParam, date: dateParam, resource: resourceParam } = await searchParams;
  const view: ViewMode = viewParam === "week" || viewParam === "day" ? viewParam : "month";
  const anchorDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayKey();
  const resourceView = resourceParam === "1" && view === "day";

  const { start, end } = rangeFor(view, anchorDate);
  const [bookings, teamMembers] = await Promise.all([
    listBookingsInRange(start, end),
    listTeamMembers(),
  ]);
  const activeMembers = teamMembers.filter((m) => m.isActive).map((m) => ({ id: m.id, name: m.name }));

  const { year, month } = parseDateKey(anchorDate);
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const step = view === "week" ? 7 : 1;
  const prevDate = view === "month" ? toDateKey(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1, 1) : addDays(anchorDate, -step);
  const nextDate = view === "month" ? toDateKey(nextMonthDate.getUTCFullYear(), nextMonthDate.getUTCMonth() + 1, 1) : addDays(anchorDate, step);

  const label = view === "month" ? monthLabel(year, month) : view === "week" ? `Week of ${dayLabel(startOfWeek(anchorDate))}` : dayLabel(anchorDate);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Calendar</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{bookings.length} scheduled this view</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={navHref(view, prevDate, resourceView)} className="flex size-9 items-center justify-center rounded-lg border border-admin-border text-admin-text hover:bg-admin-bg" aria-label="Previous">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <p className="w-56 text-center text-sm font-semibold text-admin-text">{label}</p>
          <Link href={navHref(view, nextDate, resourceView)} className="flex size-9 items-center justify-center rounded-lg border border-admin-border text-admin-text hover:bg-admin-bg" aria-label="Next">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-admin-border bg-admin-card p-1 w-fit">
          {(["month", "week", "day"] as const).map((v) => (
            <Link key={v} href={navHref(v, v === "day" && view !== "day" ? todayKey() : anchorDate, resourceView)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${view === v ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}>
              {v}
            </Link>
          ))}
        </div>
        {view === "day" && (
          <Link
            href={navHref("day", anchorDate, !resourceView)}
            className={`ios-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${resourceView ? "bg-admin-teal text-white" : "border border-admin-border text-admin-text-muted hover:text-admin-text"}`}
          >
            {resourceView ? <Columns3 className="size-3.5" aria-hidden /> : <CalendarIcon className="size-3.5" aria-hidden />}
            {resourceView ? "By cleaner" : "Show by cleaner"}
          </Link>
        )}
        <Link href={navHref(view, todayKey(), resourceView)} className="text-xs font-semibold text-admin-teal-hover hover:underline">Today</Link>
      </div>

      <p className="mt-3 text-xs text-admin-text-muted">Drag a booking to move it -- releases when it lands on a new day or time.</p>

      <div className="mt-3">
        {bookings.length === 0 && view !== "month" ? (
          <Card>
            <p className="text-sm text-admin-text-muted">Nothing scheduled in this view.</p>
          </Card>
        ) : (
          <CalendarBoard bookings={bookings} teamMembers={activeMembers} view={view} anchorDate={anchorDate} resourceView={resourceView} />
        )}
      </div>

      <StatusLegend />
    </div>
  );
}
