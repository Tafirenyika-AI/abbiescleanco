import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listBookingsInRange, bookingStatusLabels, type BookingStatusValue } from "@/lib/server/bookingStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";

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

// Business is in Spokane Valley, WA — display everything in that timezone
// regardless of where the server or admin's browser happens to be, so the
// server-rendered HTML and the hydrated client always agree (and so the
// calendar's "day" for a booking matches the business's actual day).
const BUSINESS_TZ = "America/Los_Angeles";

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function businessDayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function businessTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default async function AdminCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const monthIndex = month - 1;

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0=Sun
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - startWeekday);

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + totalCells - 1);
  gridEnd.setUTCHours(23, 59, 59, 999);

  const bookings = await listBookingsInRange(gridStart.toISOString(), gridEnd.toISOString());
  const byDay = new Map<string, typeof bookings>();
  for (const b of bookings) {
    if (!b.scheduledStart) continue;
    const key = businessDayKey(b.scheduledStart);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(b);
  }

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    cells.push({ date: d, inMonth: d.getUTCMonth() === monthIndex });
  }

  const prevMonth = new Date(Date.UTC(year, monthIndex - 1, 1));
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));
  const todayKey = businessDayKey(new Date().toISOString());

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Calendar</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{bookings.length} scheduled this view</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendar?month=${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, "0")}`} className="flex size-9 items-center justify-center rounded-lg border border-admin-border text-admin-text hover:bg-admin-bg" aria-label="Previous month">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <p className="w-40 text-center text-sm font-semibold text-admin-text">{monthLabel(year, monthIndex)}</p>
          <Link href={`/admin/calendar?month=${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}`} className="flex size-9 items-center justify-center rounded-lg border border-admin-border text-admin-text hover:bg-admin-bg" aria-label="Next month">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <p className="mt-3 text-xs text-admin-text-muted">
        Drag-and-drop rescheduling isn&apos;t built yet, click a booking below, then use Reschedule on its detail page.
      </p>

      <Card className="mt-4" padded={false}>
        <div className="grid grid-cols-7 border-b border-admin-border text-center text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map(({ date, inMonth }) => {
            const key = date.toISOString().slice(0, 10);
            const dayBookings = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div key={key} className={`min-h-[110px] border-b border-r border-admin-border p-1.5 last:border-r-0 ${inMonth ? "bg-admin-card" : "bg-admin-bg/40"}`}>
                <p className={`text-xs font-semibold ${isToday ? "flex size-5 items-center justify-center rounded-full bg-admin-teal text-white" : inMonth ? "text-admin-text" : "text-admin-text-muted"}`}>
                  {date.getUTCDate()}
                </p>
                <div className="mt-1 space-y-1">
                  {dayBookings.slice(0, 3).map((b) => (
                    <Link
                      key={b.id}
                      href={`/admin/bookings/${b.id}`}
                      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80"
                      style={{ backgroundColor: "var(--color-admin-teal)", color: "white", opacity: 0.85 }}
                      title={`${b.customerName}, ${bookingStatusLabels[b.status]}`}
                    >
                      {b.scheduledStart && businessTimeLabel(b.scheduledStart)} {b.customerName}
                    </Link>
                  ))}
                  {dayBookings.length > 3 && <p className="text-[10px] text-admin-text-muted">+{dayBookings.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(bookingStatusLabels).map(([status, label]) => (
          <Badge key={status} tone={statusTone[status as BookingStatusValue]}>{label}</Badge>
        ))}
      </div>
    </div>
  );
}
