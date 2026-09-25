import { randomUUID } from "crypto";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { sendSms } from "@/lib/server/sms";
import { sendEmail } from "@/lib/server/email";
import { initiateCall } from "@/lib/server/voice";
import { business } from "@/lib/data/business";

/**
 * Real live "cleaner is on the way" tracking (the Uber/DoorDash vibe), deliberately built without
 * a persistent cleaner login/account -- see CleanerLocationShare's own doc comment in
 * schema.prisma. Each share is a one-time, time-boxed link sent by SMS to whoever's actually
 * driving; there's no way to look one up except by its unguessable token (the row's id).
 */

const SHARE_HOURS = 6; // safety-net cutoff if nobody ever taps "Stop sharing"
const MIN_UPDATE_INTERVAL_MS = 5000; // server-side floor, independent of whatever the client throttles to

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Live tracking requires DATABASE_URL to be configured.");
  return prisma;
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://abbiescleanco.vercel.app";
}

export interface CreateShareResult {
  ok: boolean;
  error?: string;
  url?: string;
  smsSent?: boolean;
}

/** Ends any share already active for this booking, then creates a fresh one and texts the link. */
export async function createLocationShare(bookingId: string, phone: string, adminUserId: string): Promise<CreateShareResult> {
  const booking = await db().booking.findFirst({ where: { id: bookingId, deletedAt: null }, include: { lead: { include: { service: true } } } });
  if (!booking) return { ok: false, error: "Booking not found" };

  await db().cleanerLocationShare.updateMany({
    where: { bookingId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const id = randomUUID().replace(/-/g, "");
  await db().cleanerLocationShare.create({
    data: { id, bookingId, phone, expiresAt: new Date(Date.now() + SHARE_HOURS * 60 * 60 * 1000), createdById: adminUserId },
  });

  const url = `${siteUrl()}/track/${id}`;
  const serviceName = booking.lead?.service.name ?? "cleaning";
  const sms = await sendSms(phone, `${business.name}: tap to share your live location for the ${serviceName} job -- ${url}`);
  return { ok: true, url, smsSent: sms.ok };
}

export interface TrackingPageInfo {
  ok: true;
  active: boolean; // false if ended/expired -- the page shows an honest "link no longer active" state
  address: string;
  serviceName: string;
  scheduledStart: string | null;
}

export async function getShareForTrackingPage(token: string): Promise<TrackingPageInfo | { ok: false }> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false };
  const share = await db().cleanerLocationShare.findUnique({
    where: { id: token },
    include: { booking: { include: { address: true, lead: { include: { service: true } } } } },
  });
  if (!share) return { ok: false };
  const active = !share.endedAt && share.expiresAt.getTime() > Date.now();
  const addr = share.booking.address;
  return {
    ok: true,
    active,
    address: `${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`,
    serviceName: share.booking.lead?.service.name ?? "cleaning",
    scheduledStart: share.booking.scheduledStart ? share.booking.scheduledStart.toISOString() : null,
  };
}

export async function recordLocation(token: string, lat: number, lng: number, accuracyMeters: number | null): Promise<{ ok: boolean; error?: string }> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false, error: "Not found" };
  const share = await db().cleanerLocationShare.findUnique({ where: { id: token } });
  if (!share) return { ok: false, error: "Not found" };
  if (share.endedAt) return { ok: false, error: "This tracking link has been stopped" };
  if (share.expiresAt.getTime() <= Date.now()) return { ok: false, error: "This tracking link has expired" };
  if (share.lastUpdatedAt && Date.now() - share.lastUpdatedAt.getTime() < MIN_UPDATE_INTERVAL_MS) return { ok: true }; // silently throttled, not an error
  await db().cleanerLocationShare.update({
    where: { id: token },
    data: { lastLat: lat, lastLng: lng, lastAccuracyMeters: accuracyMeters, lastUpdatedAt: new Date() },
  });
  return { ok: true };
}

export async function stopSharing(token: string): Promise<{ ok: boolean }> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false };
  await db().cleanerLocationShare.updateMany({ where: { id: token, endedAt: null }, data: { endedAt: new Date() } });
  return { ok: true };
}

export interface BookingLocation {
  active: boolean;
  lat?: number;
  lng?: number;
  updatedAt?: string;
}

/**
 * What the customer's booking page reads. Gated on real booking status, not just the share's own
 * endedAt/expiresAt -- once a job has actually started (or later), "on the way" tracking is moot
 * regardless of whether anyone remembered to tap "Stop sharing".
 */
export async function getActiveLocationForBooking(bookingId: string): Promise<BookingLocation> {
  const booking = await db().booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!booking || !["REQUESTED", "CONFIRMED", "SCHEDULED", "ON_THE_WAY"].includes(booking.status)) return { active: false };

  const share = await db().cleanerLocationShare.findFirst({
    where: { bookingId, endedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!share || share.lastLat === null || share.lastLng === null || !share.lastUpdatedAt) return { active: false };
  return { active: true, lat: share.lastLat, lng: share.lastLng, updatedAt: share.lastUpdatedAt.toISOString() };
}

/** Loose lookup by token -- unlike location/messaging reads, this doesn't require the share to
 *  still be "active"; a cleaner should be able to keep messaging/calling through the job even
 *  after GPS sharing itself has stopped. Only a genuinely nonexistent token, or a booking that's
 *  wrapped up, is rejected. */
export async function resolveBookingForToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const share = await db().cleanerLocationShare.findUnique({ where: { id: token }, select: { bookingId: true, phone: true } });
  if (!share) return null;
  const booking = await db().booking.findUnique({ where: { id: share.bookingId }, select: { status: true } });
  if (!booking || ["COMPLETED", "CANCELLED"].includes(booking.status)) return null;
  return { bookingId: share.bookingId, cleanerPhone: share.phone };
}

async function getCleanerPhone(bookingId: string): Promise<string | null> {
  const share = await db().cleanerLocationShare.findFirst({ where: { bookingId, phone: { not: null } }, orderBy: { createdAt: "desc" } });
  return share?.phone ?? null;
}

async function getCustomerContact(bookingId: string) {
  const booking = await db().booking.findUnique({ where: { id: bookingId }, include: { customer: true } });
  if (!booking) return null;
  return { name: `${booking.customer.firstName} ${booking.customer.lastName}`.trim(), phone: booking.customer.phone, email: booking.customer.email };
}

export interface CleanerMessageItem {
  id: string;
  sender: "CUSTOMER" | "CLEANER";
  body: string;
  createdAt: string;
}

export async function listMessagesForBooking(bookingId: string): Promise<CleanerMessageItem[]> {
  const rows = await db().cleanerMessage.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, take: 200 });
  return rows.map((m) => ({ id: m.id, sender: m.sender as "CUSTOMER" | "CLEANER", body: m.body.slice(0, 2000), createdAt: m.createdAt.toISOString() }));
}

/** Best-effort: the message is saved regardless of whether notifying the other party succeeds. */
export async function sendMessage(bookingId: string, sender: "CUSTOMER" | "CLEANER", body: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) return { ok: false, error: "Message can't be empty" };
  await db().cleanerMessage.create({ data: { bookingId, sender, body: trimmed } });

  if (sender === "CUSTOMER") {
    const phone = await getCleanerPhone(bookingId);
    if (phone) await sendSms(phone, `New message from your client: ${trimmed}`);
  } else {
    const customer = await getCustomerContact(bookingId);
    if (customer?.phone) await sendSms(customer.phone, `New message from ${business.name}: ${trimmed}`);
    if (customer?.email) await sendEmail({ to: customer.email, subject: "New message about your cleaning visit", html: `<p>${trimmed.replace(/</g, "&lt;")}</p>` });
  }
  return { ok: true };
}

/**
 * Creates a short-lived bridge pointer and dials `firstLegPhone`; once they answer, Twilio's
 * webhook resolves this bridge to `targetPhone` and dials that -- neither party's real number is
 * ever exposed to the other or embedded in a client-visible URL.
 */
async function startBridgedCall(bookingId: string, firstLegPhone: string, targetPhone: string): Promise<{ ok: boolean; error?: string }> {
  const id = randomUUID().replace(/-/g, "");
  await db().callBridge.create({ data: { id, bookingId, targetPhone } });
  const result = await initiateCall(firstLegPhone, `${siteUrl()}/api/twiml/bridge/${id}`);
  if (!result.ok) return { ok: false, error: result.error || "Couldn't place the call" };
  return { ok: true };
}

export async function callCleanerFromCustomer(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const [customer, cleanerPhone] = await Promise.all([getCustomerContact(bookingId), getCleanerPhone(bookingId)]);
  if (!customer) return { ok: false, error: "Booking not found" };
  if (!cleanerPhone) return { ok: false, error: "No cleaner phone on file yet for this job" };
  return startBridgedCall(bookingId, customer.phone, cleanerPhone);
}

export async function callCustomerFromCleaner(token: string): Promise<{ ok: boolean; error?: string }> {
  const resolved = await resolveBookingForToken(token);
  if (!resolved) return { ok: false, error: "This link isn't active" };
  if (!resolved.cleanerPhone) return { ok: false, error: "No phone on file for this link" };
  const customer = await getCustomerContact(resolved.bookingId);
  if (!customer) return { ok: false, error: "Booking not found" };
  return startBridgedCall(resolved.bookingId, resolved.cleanerPhone, customer.phone);
}

const BRIDGE_MAX_AGE_MS = 10 * 60 * 1000;

/** Called only by Twilio's own webhook request for a call session we just created. */
export async function getCallBridgeTarget(id: string): Promise<string | null> {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const bridge = await db().callBridge.findUnique({ where: { id } });
  if (!bridge || Date.now() - bridge.createdAt.getTime() > BRIDGE_MAX_AGE_MS) return null;
  return bridge.targetPhone;
}
