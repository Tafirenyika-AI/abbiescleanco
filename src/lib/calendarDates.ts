/** Client-safe calendar date helpers, shared between the calendar server page (nav links/labels)
 *  and CalendarBoard (grid layout) -- business is in Spokane Valley, WA, so every date/time
 *  boundary is computed in that timezone regardless of where the server or browser actually is. */

export const BUSINESS_TZ = "America/Los_Angeles";

export function businessDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function businessTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** Minutes since local midnight (Pacific) for a given ISO instant -- used to position a booking on a time-grid. */
export function businessMinutesOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/** Parses a "YYYY-MM-DD" anchor into {year, month (1-12), day}. */
export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Adds `days` to a "YYYY-MM-DD" key, staying calendar-correct across month/year boundaries. */
export function addDays(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** The Sunday on/before the given "YYYY-MM-DD" key. */
export function startOfWeek(key: string): string {
  const { year, month, day } = parseDateKey(key);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(key, -weekday);
}

export function monthLabel(year: number, month1to12: number): string {
  return new Date(Date.UTC(year, month1to12 - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function dayLabel(key: string): string {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function shortDayLabel(key: string): { weekday: string; day: number } {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day));
  return { weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), day };
}

export function todayKey(): string {
  return businessDayKey(new Date().toISOString());
}
