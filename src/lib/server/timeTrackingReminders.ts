import { prisma, isDatabaseConfigured } from "@/lib/db";
import { sendEmail } from "@/lib/server/email";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { business } from "@/lib/data/business";

/**
 * Real clock-in/out (see bookingStore.ts's clockInViaToken/clockOutViaToken) has no login and no
 * push notifications of its own, so a cleaner who forgets to tap a button has nothing reminding
 * them -- these three checks close that gap. Always-on (not part of the admin-configurable
 * AutomationRules toggle set in automationStore.ts) since this is an operational safety net, not a
 * customer-facing marketing touchpoint a business would want to turn off.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Time-tracking reminders require DATABASE_URL to be configured.");
  return prisma;
}

const CLOCK_IN_GRACE_MINUTES = 30; // how late past scheduledStart before nudging about a missed clock-in
const APPROACHING_FINISH_MINUTES = 15; // how close to the estimated finish before the "you're close" nudge
const CLOCK_OUT_GRACE_MINUTES = 60; // how far past the estimated finish before nudging about a missed clock-out

async function findStaffEmail(staffAssignee: string | null): Promise<string | null> {
  if (!staffAssignee?.trim()) return null;
  const member = await db().teamMember.findFirst({
    where: { deletedAt: null, name: { equals: staffAssignee.trim(), mode: "insensitive" } },
    select: { email: true },
  });
  return member?.email ?? null;
}

function estimatedDurationMs(b: { durationMinutes: number | null; scheduledStart: Date | null; scheduledEnd: Date | null }): number | null {
  if (b.durationMinutes) return b.durationMinutes * 60 * 1000;
  if (b.scheduledStart && b.scheduledEnd) return b.scheduledEnd.getTime() - b.scheduledStart.getTime();
  return null;
}

export interface TimeTrackingReminderResult {
  clockInReminders: number;
  finishReminders: number;
  clockOutReminders: number;
}

export async function processTimeTrackingReminders(): Promise<TimeTrackingReminderResult> {
  if (!isDatabaseConfigured || !prisma) return { clockInReminders: 0, finishReminders: 0, clockOutReminders: 0 };
  const now = new Date();
  let clockInReminders = 0;
  let finishReminders = 0;
  let clockOutReminders = 0;

  // 1. Forgot to clock in: still SCHEDULED/CONFIRMED/ON_THE_WAY well past its scheduled start.
  const overdueToStart = await db().booking.findMany({
    where: {
      deletedAt: null,
      status: { in: ["CONFIRMED", "SCHEDULED", "ON_THE_WAY"] },
      clockInReminderSentAt: null,
      scheduledStart: { lt: new Date(now.getTime() - CLOCK_IN_GRACE_MINUTES * 60 * 1000), gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true, reference: true, staffAssignee: true, scheduledStart: true },
  });
  for (const b of overdueToStart) {
    const when = b.scheduledStart ? b.scheduledStart.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }) : "the scheduled time";
    const email = await findStaffEmail(b.staffAssignee);
    if (email) {
      await sendEmail({
        to: email,
        subject: `${business.name}: clock in for booking ${b.reference}`,
        html: `<p>Booking ${b.reference} was scheduled to start at ${when} and hasn't been clocked in yet. Tap your tracking link and hit "Clock in" once you're there.</p>`,
      });
    }
    await notifyAdmins("TIME_TRACKING", `Missed clock-in: ${b.reference}`, `${b.staffAssignee || "No cleaner assigned"} hasn't clocked in yet, was due ${when}.`, `/admin/bookings/${b.id}`);
    await db().booking.update({ where: { id: b.id }, data: { clockInReminderSentAt: now } });
    clockInReminders++;
  }

  // 2 & 3. Approaching finish / forgot to clock out -- both derived from the same estimated-finish math.
  const inProgress = await db().booking.findMany({
    where: { deletedAt: null, status: "IN_PROGRESS", actualStart: { not: null } },
    select: {
      id: true, reference: true, staffAssignee: true, actualStart: true,
      durationMinutes: true, scheduledStart: true, scheduledEnd: true,
      finishReminderSentAt: true, clockOutReminderSentAt: true,
    },
  });
  for (const b of inProgress) {
    const durationMs = estimatedDurationMs(b);
    if (!durationMs || !b.actualStart) continue;
    const estimatedFinish = new Date(b.actualStart.getTime() + durationMs);
    const minutesToFinish = (estimatedFinish.getTime() - now.getTime()) / 60000;

    if (!b.finishReminderSentAt && minutesToFinish <= APPROACHING_FINISH_MINUTES && minutesToFinish > -5) {
      const email = await findStaffEmail(b.staffAssignee);
      if (email) {
        await sendEmail({
          to: email,
          subject: `${business.name}: almost done? Booking ${b.reference}`,
          html: `<p>You're close to the estimated finish time for booking ${b.reference}. Tap your tracking link and hit "Clock out" once you're done.</p>`,
        });
      }
      await db().booking.update({ where: { id: b.id }, data: { finishReminderSentAt: now } });
      finishReminders++;
      continue; // don't also fire the (much later) forgot-to-clock-out check in the same pass
    }

    if (!b.clockOutReminderSentAt && now.getTime() - estimatedFinish.getTime() >= CLOCK_OUT_GRACE_MINUTES * 60 * 1000) {
      const email = await findStaffEmail(b.staffAssignee);
      if (email) {
        await sendEmail({
          to: email,
          subject: `${business.name}: did you forget to clock out? Booking ${b.reference}`,
          html: `<p>Booking ${b.reference} is still showing as in progress, well past its estimated finish time. If you're done, tap your tracking link and hit "Clock out".</p>`,
        });
      }
      await notifyAdmins("TIME_TRACKING", `Missed clock-out: ${b.reference}`, `${b.staffAssignee || "No cleaner assigned"} is still clocked in, well past the estimated finish time.`, `/admin/bookings/${b.id}`);
      await db().booking.update({ where: { id: b.id }, data: { clockOutReminderSentAt: now } });
      clockOutReminders++;
    }
  }

  return { clockInReminders, finishReminders, clockOutReminders };
}
