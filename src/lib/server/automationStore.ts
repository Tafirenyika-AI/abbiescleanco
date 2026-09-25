import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import {
  sendQuoteFollowUp,
  sendFinalQuoteFollowUp,
  sendBookingConfirmation,
  sendAppointmentReminder,
  sendOnTheWayNotice,
  sendPostServiceFollowUp,
  sendReviewRequest,
  sendWinBackMessage,
} from "./automation";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Automations require DATABASE_URL to be configured.");
  return prisma;
}

/** The subset of AutomationEventType that's scheduled/processed by the cron loop below. NEW_LEAD fires synchronously in /api/quote; REVIEW_REQUEST is admin-triggered by a button, not time-based; RECURRING_ENROLLMENT has no feature to hang off yet. */
export const CONFIGURABLE_AUTOMATION_TYPES = [
  "QUOTE_FOLLOW_UP_1",
  "QUOTE_FOLLOW_UP_2",
  "BOOKING_CONFIRMATION",
  "REMINDER_48H",
  "REMINDER_24H",
  "REMINDER_DAY_OF",
  "POST_SERVICE_THANK_YOU",
  "WIN_BACK",
] as const;
export type ConfigurableAutomationType = (typeof CONFIGURABLE_AUTOMATION_TYPES)[number];

export interface AutomationRuleConfig {
  enabled: boolean;
  /** Hours after the triggering event for time-delayed types; days-of-inactivity for WIN_BACK. Ignored by the fixed-offset reminder/confirmation types. */
  offsetHours?: number;
}
export type AutomationRules = Record<ConfigurableAutomationType, AutomationRuleConfig>;

export const automationRuleLabels: Record<ConfigurableAutomationType, string> = {
  QUOTE_FOLLOW_UP_1: "First quote follow-up",
  QUOTE_FOLLOW_UP_2: "Second (final) quote follow-up",
  BOOKING_CONFIRMATION: "Booking confirmation",
  REMINDER_48H: "48-hour appointment reminder",
  REMINDER_24H: "24-hour appointment reminder",
  REMINDER_DAY_OF: "Day-of appointment reminder",
  POST_SERVICE_THANK_YOU: "Post-service thank-you",
  WIN_BACK: "Win-back re-engagement",
};

// WIN_BACK defaults to off — a re-engagement message needs a business decision on tone/timing
// before it goes out unattended, matching how recurring-service discounts stayed off by default
// until specifically approved (see lib/pricing.ts).
const defaultRules: AutomationRules = {
  QUOTE_FOLLOW_UP_1: { enabled: true, offsetHours: 48 },
  QUOTE_FOLLOW_UP_2: { enabled: true, offsetHours: 120 },
  BOOKING_CONFIRMATION: { enabled: true },
  REMINDER_48H: { enabled: true },
  REMINDER_24H: { enabled: true },
  REMINDER_DAY_OF: { enabled: true },
  POST_SERVICE_THANK_YOU: { enabled: true, offsetHours: 2 },
  WIN_BACK: { enabled: false, offsetHours: 60 * 24 },
};

export async function getAutomationRules(): Promise<AutomationRules> {
  if (!isDatabaseConfigured || !prisma) return defaultRules;
  const row = await prisma.businessSetting.findUnique({ where: { key: "automation_rules" } });
  const stored = (row?.value as Partial<AutomationRules> | undefined) ?? {};
  const merged = { ...defaultRules } as AutomationRules;
  for (const key of CONFIGURABLE_AUTOMATION_TYPES) {
    if (stored[key]) merged[key] = { ...defaultRules[key], ...stored[key] };
  }
  return merged;
}

export async function setAutomationRules(rules: AutomationRules): Promise<void> {
  await db().businessSetting.upsert({
    where: { key: "automation_rules" },
    update: { value: rules as unknown as Prisma.InputJsonValue },
    create: { key: "automation_rules", value: rules as unknown as Prisma.InputJsonValue },
  });
}

async function alreadyScheduled(type: ConfigurableAutomationType, leadId?: string, bookingId?: string): Promise<boolean> {
  const existing = await db().automationEvent.findFirst({
    where: { type, leadId: leadId ?? undefined, bookingId: bookingId ?? undefined, status: { in: ["PENDING", "SENT"] } },
  });
  return !!existing;
}

/** Idempotent: a second call for the same type+lead/booking while one is still PENDING or already SENT is a no-op. */
export async function scheduleAutomationEvent(
  type: ConfigurableAutomationType,
  opts: { leadId?: string; bookingId?: string; scheduledFor: Date }
): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  const rules = await getAutomationRules();
  if (!rules[type]?.enabled) return;
  if (await alreadyScheduled(type, opts.leadId, opts.bookingId)) return;
  await prisma.automationEvent.create({
    data: { type, leadId: opts.leadId, bookingId: opts.bookingId, scheduledFor: opts.scheduledFor, status: "PENDING" },
  });
}

/** Called right after a lead is created — schedules both quote follow-ups per the currently configured offsets. */
export async function scheduleQuoteFollowUps(leadId: string): Promise<void> {
  const rules = await getAutomationRules();
  await scheduleAutomationEvent("QUOTE_FOLLOW_UP_1", {
    leadId,
    scheduledFor: new Date(Date.now() + (rules.QUOTE_FOLLOW_UP_1.offsetHours ?? 48) * 60 * 60 * 1000),
  });
  await scheduleAutomationEvent("QUOTE_FOLLOW_UP_2", {
    leadId,
    scheduledFor: new Date(Date.now() + (rules.QUOTE_FOLLOW_UP_2.offsetHours ?? 120) * 60 * 60 * 1000),
  });
}

/** Called when a booking is confirmed — schedules the confirmation email plus any reminders that still have lead time before scheduledStart. */
export async function scheduleBookingConfirmationAndReminders(bookingId: string, scheduledStart: Date): Promise<void> {
  const now = Date.now();
  await scheduleAutomationEvent("BOOKING_CONFIRMATION", { bookingId, scheduledFor: new Date() });

  const reminderOffsets: { type: ConfigurableAutomationType; hoursBefore: number }[] = [
    { type: "REMINDER_48H", hoursBefore: 48 },
    { type: "REMINDER_24H", hoursBefore: 24 },
    { type: "REMINDER_DAY_OF", hoursBefore: 3 },
  ];
  for (const { type, hoursBefore } of reminderOffsets) {
    const fireAt = scheduledStart.getTime() - hoursBefore * 60 * 60 * 1000;
    if (fireAt > now) await scheduleAutomationEvent(type, { bookingId, scheduledFor: new Date(fireAt) });
  }
}

/** Called when a booking is marked completed. */
export async function schedulePostServiceThankYou(bookingId: string): Promise<void> {
  const rules = await getAutomationRules();
  await scheduleAutomationEvent("POST_SERVICE_THANK_YOU", {
    bookingId,
    scheduledFor: new Date(Date.now() + (rules.POST_SERVICE_THANK_YOU.offsetHours ?? 2) * 60 * 60 * 1000),
  });
}

async function getBookingWithRecipient(bookingId: string) {
  const booking = await db().booking.findUnique({
    where: { id: bookingId },
    include: { customer: { include: { communicationPreference: true } }, lead: { include: { service: true } } },
  });
  if (!booking || !booking.customer) return null;
  return {
    status: booking.status,
    reference: booking.reference,
    scheduledStart: booking.scheduledStart,
    arrivalWindow: booking.arrivalWindow,
    serviceName: booking.lead?.service.name ?? "cleaning",
    recipient: {
      name: `${booking.customer.firstName} ${booking.customer.lastName}`.trim(),
      email: booking.customer.email,
      phone: booking.customer.phone,
      smsConsent: booking.customer.communicationPreference?.smsConsent ?? false,
    },
  };
}

type EventRow = { id: string; type: string; leadId: string | null; bookingId: string | null };

async function dispatchEvent(event: EventRow): Promise<"SENT" | "SKIPPED" | "FAILED"> {
  switch (event.type) {
    case "QUOTE_FOLLOW_UP_1":
    case "QUOTE_FOLLOW_UP_2": {
      if (!event.leadId) return "FAILED";
      const lead = await db().lead.findUnique({ where: { id: event.leadId }, include: { customer: true, quotes: true } });
      if (!lead || !lead.customer) return "FAILED";
      if (lead.quotes.some((q) => q.status === "ACCEPTED" || q.status === "DECLINED")) return "SKIPPED";
      // A real client on file with no email (not tech-savvy) has nothing to skip here -- honest
      // SKIPPED, not a FAILED delivery attempt.
      if (!lead.customer.email) return "SKIPPED";
      const recipient = {
        name: `${lead.customer.firstName} ${lead.customer.lastName}`.trim(),
        email: lead.customer.email,
        phone: lead.customer.phone,
        smsConsent: false,
      };
      const result =
        event.type === "QUOTE_FOLLOW_UP_1"
          ? await sendQuoteFollowUp(recipient, lead.reference)
          : await sendFinalQuoteFollowUp(recipient, lead.reference);
      return result.ok ? "SENT" : "FAILED";
    }
    case "BOOKING_CONFIRMATION": {
      if (!event.bookingId) return "FAILED";
      const booking = await getBookingWithRecipient(event.bookingId);
      if (!booking || !booking.scheduledStart) return "FAILED";
      if (booking.status === "CANCELLED") return "SKIPPED";
      if (!booking.recipient.email) return "SKIPPED";
      const result = await sendBookingConfirmation(booking.recipient, {
        serviceName: booking.serviceName,
        scheduledStart: booking.scheduledStart,
        arrivalWindow: booking.arrivalWindow ?? undefined,
        reference: booking.reference,
      });
      return result.ok ? "SENT" : "FAILED";
    }
    case "REMINDER_48H":
    case "REMINDER_24H":
    case "REMINDER_DAY_OF": {
      if (!event.bookingId) return "FAILED";
      const booking = await getBookingWithRecipient(event.bookingId);
      if (!booking || !booking.scheduledStart) return "FAILED";
      if (booking.status === "CANCELLED" || booking.status === "COMPLETED") return "SKIPPED";
      const stage = event.type === "REMINDER_48H" ? "48h" : event.type === "REMINDER_24H" ? "24h" : "day-of";
      const results = await sendAppointmentReminder(booking.recipient, { serviceName: booking.serviceName, scheduledStart: booking.scheduledStart, stage });
      // Neither email nor SMS-consented -- genuinely nothing to send, not a failed delivery.
      if (results.length === 0) return "SKIPPED";
      return results.every((r) => r.ok) ? "SENT" : "FAILED";
    }
    case "POST_SERVICE_THANK_YOU": {
      if (!event.bookingId) return "FAILED";
      const booking = await getBookingWithRecipient(event.bookingId);
      if (!booking) return "FAILED";
      if (!booking.recipient.email) return "SKIPPED";
      const result = await sendPostServiceFollowUp(booking.recipient);
      return result.ok ? "SENT" : "FAILED";
    }
    case "WIN_BACK": {
      if (!event.bookingId) return "FAILED";
      const booking = await getBookingWithRecipient(event.bookingId);
      if (!booking) return "FAILED";
      if (!booking.recipient.email) return "SKIPPED";
      const result = await sendWinBackMessage(booking.recipient);
      return result.ok ? "SENT" : "FAILED";
    }
    default:
      return "SKIPPED";
  }
}

/** Customers whose most recent COMPLETED booking is old enough, and who haven't had a WIN_BACK sent in the same window — schedules one WIN_BACK event each, if the rule is enabled. */
async function scanForWinBack(): Promise<void> {
  const rules = await getAutomationRules();
  const rule = rules.WIN_BACK;
  if (!rule.enabled) return;
  const thresholdDays = rule.offsetHours ? rule.offsetHours / 24 : 60;
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const candidates = await db().booking.findMany({
    where: { status: "COMPLETED", scheduledEnd: { lte: cutoff }, deletedAt: null },
    include: { customer: true },
    orderBy: { scheduledEnd: "desc" },
    take: 500,
  });

  const seenCustomers = new Set<string>();
  for (const booking of candidates) {
    if (!booking.customerId || seenCustomers.has(booking.customerId)) continue;
    seenCustomers.add(booking.customerId);

    const hasNewerBooking = await db().booking.findFirst({
      where: { customerId: booking.customerId, scheduledStart: { gt: booking.scheduledEnd ?? booking.scheduledStart ?? new Date(0) }, deletedAt: null },
    });
    if (hasNewerBooking) continue;

    await scheduleAutomationEvent("WIN_BACK", { bookingId: booking.id, scheduledFor: new Date() });
  }
}

export interface ProcessResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function processDueAutomationEvents(): Promise<ProcessResult> {
  if (!isDatabaseConfigured || !prisma) return { processed: 0, sent: 0, skipped: 0, failed: 0 };

  const due = await prisma.automationEvent.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    take: 200,
  });

  let sent = 0, skipped = 0, failed = 0;
  for (const event of due) {
    let outcome: "SENT" | "SKIPPED" | "FAILED";
    try {
      outcome = await dispatchEvent(event);
    } catch {
      outcome = "FAILED";
    }
    await prisma.automationEvent.update({ where: { id: event.id }, data: { status: outcome, processedAt: new Date() } });
    if (outcome === "SENT") sent++;
    else if (outcome === "SKIPPED") skipped++;
    else failed++;
  }

  await scanForWinBack();

  return { processed: due.length, sent, skipped, failed };
}

export interface AutomationEventLogItem {
  id: string;
  type: string;
  status: string;
  scheduledFor: string | null;
  processedAt: string | null;
  createdAt: string;
  leadReference: string | null;
  bookingReference: string | null;
}

export async function listRecentAutomationEvents(limit = 100): Promise<AutomationEventLogItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const rows = await prisma.automationEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { lead: true, booking: true },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    scheduledFor: r.scheduledFor?.toISOString() ?? null,
    processedAt: r.processedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    leadReference: r.lead?.reference ?? null,
    bookingReference: r.booking?.reference ?? null,
  }));
}

/** Manual, admin-triggered send — review requests are only ever sent to a customer who's confirmed they're happy, never automatically. */
/**
 * Fired immediately when an admin marks a booking ON_THE_WAY -- not scheduled through the
 * PENDING-event cron, since the whole point is "right now". Best-effort: a customer with no
 * email and no SMS consent genuinely has nothing to send to, recorded as SKIPPED rather than
 * treated as an error, and a real send failure never blocks the status change itself (the
 * booking is on the way regardless of whether the notification got through).
 */
export async function notifyOnTheWay(bookingId: string): Promise<void> {
  const booking = await getBookingWithRecipient(bookingId);
  if (!booking) return;
  const results = await sendOnTheWayNotice(booking.recipient, { serviceName: booking.serviceName });
  const status = results.length === 0 ? "SKIPPED" : results.every((r) => r.ok) ? "SENT" : "FAILED";
  await db().automationEvent.create({ data: { type: "ON_THE_WAY_NOTICE", bookingId, status, processedAt: new Date() } });
}

export async function sendManualReviewRequest(bookingId: string, publicReviewUrl: string): Promise<{ ok: boolean; error?: string }> {
  const booking = await getBookingWithRecipient(bookingId);
  if (!booking) return { ok: false, error: "Booking or customer not found" };
  if (!booking.recipient.email) return { ok: false, error: "This customer has no email on file -- add one on their profile first." };
  const result = await sendReviewRequest(booking.recipient, publicReviewUrl);
  if (!result.ok) return { ok: false, error: result.error };
  await db().automationEvent.create({
    data: { type: "REVIEW_REQUEST", bookingId, status: "SENT", processedAt: new Date() },
  });
  return { ok: true };
}
