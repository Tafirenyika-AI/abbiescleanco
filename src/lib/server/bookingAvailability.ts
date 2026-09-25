import { business } from "@/lib/data/business";
import { findConflicts, listBookingsInRange } from "@/lib/server/bookingStore";
import { pacificWallTimeToUtc } from "@/lib/adminDate";
import type { PricingConfig } from "@/lib/pricing";
import type { ServiceId } from "@/lib/data/services";

const SLOT_STEP_MINUTES = 60;
/** No same-day self-service requests -- keeps a minimum window for the business to review before the slot arrives. */
const MIN_LEAD_HOURS = 24;

function weekdayNameForDate(year: number, month: number, day: number): string {
  // Midday UTC is safely inside the intended calendar day in Pacific regardless of DST.
  return new Date(Date.UTC(year, month - 1, day, 20)).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
}

function hoursForDate(year: number, month: number, day: number): { opens: string; closes: string } | null {
  const weekday = weekdayNameForDate(year, month, day);
  const row = business.hoursSchema.find((h) => (h.dayOfWeek as readonly string[]).includes(weekday));
  return row ? { opens: row.opens, closes: row.closes } : null;
}

/** Duration this service is estimated to take, rounded up to the nearest half-hour so slots never overlap the next job. */
function jobDurationMinutes(serviceId: ServiceId, pricingConfig: PricingConfig): number {
  const sp = pricingConfig.services[serviceId];
  const hours = sp?.durationHoursHigh || 2;
  return Math.ceil((hours * 60) / 30) * 30;
}

export interface AvailableSlot {
  startISO: string;
  endISO: string;
  label: string; // e.g. "9:00 AM", in the business's own (Pacific) time
}

/** Available self-service booking start times for one calendar date, in the business's own timezone. */
export async function getAvailableSlots(
  serviceId: ServiceId,
  dateISO: string, // "YYYY-MM-DD"
  pricingConfig: PricingConfig
): Promise<AvailableSlot[]> {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return [];

  const hours = hoursForDate(y, m, d);
  if (!hours) return [];

  const durationMinutes = jobDurationMinutes(serviceId, pricingConfig);
  const [openH, openM] = hours.opens.split(":").map(Number);
  const [closeH, closeM] = hours.closes.split(":").map(Number);

  const slots: AvailableSlot[] = [];
  const minStart = new Date(Date.now() + MIN_LEAD_HOURS * 60 * 60 * 1000);

  for (let mins = openH * 60 + openM; mins + durationMinutes <= closeH * 60 + closeM; mins += SLOT_STEP_MINUTES) {
    const startHour = Math.floor(mins / 60);
    const startMinute = mins % 60;
    const start = pacificWallTimeToUtc(y, m, d, startHour, startMinute);
    if (start < minStart) continue;

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const conflicts = await findConflicts(start, end);
    if (conflicts.length > 0) continue;

    const displayHour = ((startHour + 11) % 12) + 1;
    slots.push({
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      label: `${displayHour}:${String(startMinute).padStart(2, "0")} ${startHour < 12 ? "AM" : "PM"}`,
    });
  }

  return slots;
}

export interface SuggestedSlot extends AvailableSlot {
  reason: string | null; // real, plain-language reason this slot ranked where it did -- empty when it's just an open slot with nothing notable about it
}

/**
 * Ranks real open slots (from getAvailableSlots -- already conflict-checked) by two honest, real
 * signals rather than any fabricated "AI" scoring: (1) sitting right next to another job in the
 * same city that day, which cuts cross-town driving, and (2) if a specific cleaner is being
 * booked, keeping THEIR day contiguous instead of leaving an awkward gap. Both are grounded in
 * real bookings already on the calendar, and every suggestion says exactly why it ranked highly.
 */
export async function getSuggestedSlots(
  serviceId: ServiceId,
  dateISO: string,
  pricingConfig: PricingConfig,
  opts: { city?: string; staffAssignee?: string } = {}
): Promise<SuggestedSlot[]> {
  const slots = await getAvailableSlots(serviceId, dateISO, pricingConfig);
  if (slots.length === 0) return [];

  const [y, m, d] = dateISO.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  const dayBookings = (await listBookingsInRange(dayStart.toISOString(), dayEnd.toISOString())).filter(
    (b) => b.status !== "CANCELLED" && b.scheduledStart && b.scheduledEnd
  );
  if (dayBookings.length === 0) return slots.map((s) => ({ ...s, reason: null }));

  const ADJACENT_MS = 60 * 60 * 1000;

  const scored = slots.map((slot) => {
    let score = 0;
    let reason: string | null = null;
    const slotStart = new Date(slot.startISO).getTime();
    const slotEnd = new Date(slot.endISO).getTime();

    for (const b of dayBookings) {
      const bStart = new Date(b.scheduledStart!).getTime();
      const bEnd = new Date(b.scheduledEnd!).getTime();
      const sameCity = !!opts.city && !!b.city && b.city.toLowerCase() === opts.city.toLowerCase();
      const sameStaff = !!opts.staffAssignee && !!b.staffAssignee && b.staffAssignee.toLowerCase() === opts.staffAssignee.toLowerCase();
      const gapBefore = slotStart - bEnd; // this slot would start shortly after that job ends
      const gapAfter = bStart - slotEnd; // this slot would end shortly before that job starts

      if (sameCity && ((gapBefore >= 0 && gapBefore <= ADJACENT_MS) || (gapAfter >= 0 && gapAfter <= ADJACENT_MS))) {
        score += 3;
        reason = `Near another ${b.city} job that day, less driving`;
      }
      if (sameStaff && ((gapBefore >= 0 && gapBefore <= ADJACENT_MS * 1.5) || (gapAfter >= 0 && gapAfter <= ADJACENT_MS * 1.5))) {
        score += 2;
        reason = reason ? `${reason}, keeps ${opts.staffAssignee}'s day together` : `Keeps ${opts.staffAssignee}'s day together, no big gap`;
      }
    }
    return { ...slot, score, reason };
  });

  return scored.sort((a, b) => b.score - a.score || a.startISO.localeCompare(b.startISO)).map(({ score: _score, ...s }) => s);
}
