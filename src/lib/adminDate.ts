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
