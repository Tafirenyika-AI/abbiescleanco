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
