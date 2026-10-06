/**
 * Business is in Spokane Valley, WA — every admin-displayed date/time uses
 * this fixed timezone (rather than the server's or browser's local zone) so
 * server-rendered HTML and the hydrated client always agree, and so times
 * shown to the admin match the business's actual clock regardless of where
 * the server happens to run.
 */
const BUSINESS_TZ = "America/Los_Angeles";

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/**
 * For fields that are a plain calendar date with no time-of-day meaning
 * (e.g. an expense's date, entered via <input type="date">). Browsers parse
 * a bare "YYYY-MM-DD" as UTC midnight, so formatting it in BUSINESS_TZ (a
 * negative UTC offset) would show the previous day — this formats in UTC
 * instead, matching how the date was parsed on the way in.
 */
export function formatCalendarDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
}

/**
 * Inverse of the above: given a wall-clock time as it would read on the business's
 * own clock (e.g. "9:00 AM" on a given date), returns the correct UTC instant,
 * accounting for DST. Two-pass Intl trick (no timezone library needed) — construct
 * a guess treating the wall time as UTC, see what that instant actually reads as in
 * Pacific, then shift the guess by the difference.
 */
export function pacificWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const shownHour = Number(map.hour) === 24 ? 0 : Number(map.hour);
  const shownAsUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), shownHour, Number(map.minute));
  const diff = guess.getTime() - shownAsUtc;
  return new Date(guess.getTime() + diff);
}

/**
 * Convenience wrapper for the common case: an admin form has a `<input type="date">` (e.g.
 * "2026-10-15") and `<input type="time">` (e.g. "08:00") pair meant as the business's own Pacific
 * wall-clock time, and needs a correct UTC ISO string to send to the API. Several admin
 * scheduling forms previously built this with plain string concatenation
 * (`` `${date}T${time}:00` `` with no timezone offset) -- harmless-looking, but a server running in
 * UTC (Vercel's default) parses an offset-less ISO string as UTC, not Pacific, silently shifting
 * every booking by the Pacific/UTC difference (7-8 hours depending on DST; e.g. an intended 8:00 AM
 * booking was stored as 8:00 AM UTC and then correctly re-displayed in Pacific as 1:00 AM).
 */
export function pacificDateTimeToUtcIso(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return pacificWallTimeToUtc(year, month, day, hour, minute).toISOString();
}
