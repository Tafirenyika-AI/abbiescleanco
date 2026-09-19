import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { getAvailableSlots } from "@/lib/server/bookingAvailability";
import { findConflicts } from "@/lib/server/bookingStore";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { isTrustedMediaUrl } from "@/lib/server/mediaUpload";
import { serviceIds } from "@/lib/validation/quote";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Database not configured");
  return prisma;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface AttachmentItem {
  id: string;
  kind: string;
  url: string;
  mimeType: string;
  caption: string | null;
  uploadedBy: string;
  createdAt: string;
}
export interface NoteItem {
  id: string;
  body: string;
  author: string;
  authorName: string | null;
  kind: string;
  createdAt: string;
}

const mapAtt = (a: { id: string; kind: string; url: string; mimeType: string; caption: string | null; uploadedBy: string; createdAt: Date }): AttachmentItem => ({
  id: a.id, kind: a.kind, url: a.url, mimeType: a.mimeType, caption: a.caption, uploadedBy: a.uploadedBy, createdAt: a.createdAt.toISOString(),
});
const mapNote = (n: { id: string; body: string; author: string; authorName: string | null; kind: string; createdAt: Date }): NoteItem => ({
  id: n.id, body: n.body, author: n.author, authorName: n.authorName, kind: n.kind, createdAt: n.createdAt.toISOString(),
});

/** Verifies the lead/booking belongs to this customer. Returns which one it is, or null. */
async function ownedTarget(customerId: string, target: { leadId?: string; bookingId?: string }) {
  if (target.bookingId) {
    const b = await db().booking.findFirst({ where: { id: target.bookingId, customerId, deletedAt: null } });
    return b ? { leadId: b.leadId ?? undefined, bookingId: b.id } : null;
  }
  if (target.leadId) {
    const l = await db().lead.findFirst({ where: { id: target.leadId, customerId, deletedAt: null } });
    return l ? { leadId: l.id, bookingId: undefined } : null;
  }
  return null;
}

export async function listThread(customerId: string, target: { leadId?: string; bookingId?: string }): Promise<{ notes: NoteItem[]; attachments: AttachmentItem[] } | null> {
  const t = await ownedTarget(customerId, target);
  if (!t) return null;
  const where = target.bookingId ? { bookingId: target.bookingId } : { leadId: target.leadId };
  const [notes, attachments] = await Promise.all([
    db().clientNote.findMany({ where: { ...where, customerId, kind: { not: "AI_ASSESSMENT" } }, orderBy: { createdAt: "asc" } }),
    db().attachment.findMany({ where: { ...where, customerId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  return { notes: notes.map(mapNote), attachments: attachments.map(mapAtt) };
}

export async function addClientNote(customerId: string, target: { leadId?: string; bookingId?: string }, body: string, kind = "NOTE", authorName?: string): Promise<Result<{ note: NoteItem }>> {
  const t = await ownedTarget(customerId, target);
  if (!t) return { ok: false, error: "Not found" };
  const note = await db().clientNote.create({
    data: { customerId, leadId: target.bookingId ? t.leadId : target.leadId, bookingId: target.bookingId, body: body.trim().slice(0, 4000), author: "CUSTOMER", authorName, kind },
  });
  await notifyAdmins(
    "NEW_MESSAGE",
    `Client note from ${authorName ?? "a customer"}`,
    body.trim().slice(0, 140),
    target.bookingId ? `/admin/bookings/${target.bookingId}` : `/admin/leads`
  );
  return { ok: true, note: mapNote(note) };
}

export async function addClientAttachment(
  customerId: string,
  target: { leadId?: string; bookingId?: string },
  media: { url: string; kind: "IMAGE" | "VIDEO"; mimeType: string; sizeBytes: number; caption?: string },
  authorName?: string
): Promise<Result<{ attachment: AttachmentItem }>> {
  const t = await ownedTarget(customerId, target);
  if (!t) return { ok: false, error: "Not found" };
  if (!isTrustedMediaUrl(media.url)) return { ok: false, error: "Untrusted file location" };
  const count = await db().attachment.count({ where: { customerId, deletedAt: null, ...(target.bookingId ? { bookingId: target.bookingId } : { leadId: target.leadId }) } });
  if (count >= 30) return { ok: false, error: "You've reached the limit of 30 files here. Delete one to add another." };
  const a = await db().attachment.create({
    data: { customerId, leadId: target.bookingId ? t.leadId : target.leadId, bookingId: target.bookingId, kind: media.kind, url: media.url, mimeType: media.mimeType, sizeBytes: media.sizeBytes, caption: media.caption?.slice(0, 300) || null, uploadedBy: "CUSTOMER" },
  });
  await notifyAdmins("NEW_MESSAGE", `New ${media.kind === "VIDEO" ? "video" : "photo"} from ${authorName ?? "a customer"}`, media.caption?.slice(0, 140) || "The client added a file to their request.", target.bookingId ? `/admin/bookings/${target.bookingId}` : `/admin/leads`);
  return { ok: true, attachment: mapAtt(a) };
}

export async function deleteClientAttachment(customerId: string, id: string): Promise<Result> {
  const a = await db().attachment.findFirst({ where: { id, customerId, uploadedBy: "CUSTOMER", deletedAt: null } });
  if (!a) return { ok: false, error: "Not found" };
  await db().attachment.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}

// ---------- Requests ----------

export async function updateRequestInstructions(customerId: string, leadId: string, text: string): Promise<Result> {
  const l = await db().lead.findFirst({ where: { id: leadId, customerId, deletedAt: null } });
  if (!l) return { ok: false, error: "Not found" };
  if (["COMPLETED", "CANCELLED", "LOST"].includes(l.status)) return { ok: false, error: "This request is closed" };
  await db().lead.update({ where: { id: leadId }, data: { additionalInstructions: text.trim().slice(0, 2000) || null } });
  await notifyAdmins("NEW_MESSAGE", "Client updated their request instructions", text.trim().slice(0, 140), `/admin/leads`);
  return { ok: true };
}

export async function withdrawRequest(customerId: string, leadId: string, reason?: string): Promise<Result> {
  const l = await db().lead.findFirst({ where: { id: leadId, customerId, deletedAt: null }, include: { bookings: true } });
  if (!l) return { ok: false, error: "Not found" };
  if (["COMPLETED", "CANCELLED", "LOST"].includes(l.status)) return { ok: false, error: "This request is already closed" };
  if (l.bookings.some((b) => !["CANCELLED", "COMPLETED"].includes(b.status))) return { ok: false, error: "Cancel the booking first, then withdraw the request" };
  await db().lead.update({ where: { id: leadId }, data: { status: "CANCELLED", lostReason: reason?.slice(0, 300) || "Withdrawn by customer" } });
  await notifyAdmins("GENERAL", "Client withdrew a request", `${l.reference}${reason ? ` — ${reason.slice(0, 120)}` : ""}`, `/admin/leads`);
  return { ok: true };
}

// ---------- Quotes ----------

export async function getMyQuoteDetail(customerId: string, quoteId: string) {
  const q = await db().quote.findFirst({
    where: { id: quoteId, deletedAt: null, lead: { customerId } },
    include: { items: true, lead: { include: { service: true } }, promoCode: true },
  });
  if (!q || q.status === "DRAFT") return null; // drafts aren't visible to customers
  return {
    id: q.id, quoteNumber: q.quoteNumber, status: q.status, subtotal: q.subtotal, discount: q.discount, tax: q.tax, deposit: q.deposit, total: q.total,
    expiresAt: q.expiresAt?.toISOString() ?? null, notes: q.notes, serviceName: q.lead.service.name, leadId: q.leadId, promoCode: q.promoCode?.code ?? null,
    items: q.items.map((i) => ({ id: i.id, label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
  };
}

export async function respondToQuote(customerId: string, quoteId: string, action: "ACCEPT" | "DECLINE", reason?: string): Promise<Result<{ status: string }>> {
  const q = await db().quote.findFirst({ where: { id: quoteId, deletedAt: null, lead: { customerId } }, include: { lead: { include: { customer: true } } } });
  if (!q) return { ok: false, error: "Not found" };
  if (q.status !== "SENT") return { ok: false, error: q.status === "ACCEPTED" ? "You've already accepted this quote" : "This quote can no longer be answered online — contact us" };
  if (q.expiresAt && q.expiresAt < new Date()) {
    await db().quote.update({ where: { id: quoteId }, data: { status: "EXPIRED" } });
    return { ok: false, error: "This quote has expired — ask us for a fresh one" };
  }
  const name = q.lead.customer ? `${q.lead.customer.firstName} ${q.lead.customer.lastName}`.trim() : "A customer";
  if (action === "ACCEPT") {
    await db().quote.update({ where: { id: quoteId }, data: { status: "ACCEPTED" } });
    await db().lead.update({ where: { id: q.leadId }, data: { status: "CONFIRMED" } });
    await notifyAdmins("QUOTE_ACCEPTED", `Quote accepted: ${name}`, `${q.quoteNumber} — $${(q.total / 100).toFixed(2)}`, `/admin/quotes/${q.id}`);
    return { ok: true, status: "ACCEPTED" };
  }
  await db().quote.update({ where: { id: quoteId }, data: { status: "DECLINED" } });
  if (reason?.trim()) await db().clientNote.create({ data: { customerId, leadId: q.leadId, body: reason.trim().slice(0, 2000), kind: "QUOTE_DECLINE", authorName: name } });
  await notifyAdmins("QUOTE_DECLINED", `Quote declined: ${name}`, `${q.quoteNumber}${reason ? ` — ${reason.slice(0, 120)}` : ""}`, `/admin/quotes/${q.id}`);
  return { ok: true, status: "DECLINED" };
}

// ---------- Bookings ----------

export async function getMyBookingDetail(customerId: string, bookingId: string) {
  const b = await db().booking.findFirst({
    where: { id: bookingId, customerId, deletedAt: null },
    include: { address: true, lead: { include: { service: true } }, quote: true, payments: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "asc" } } },
  });
  if (!b) return null;
  const paid = b.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const total = b.quote?.total ?? null;
  return {
    id: b.id, reference: b.reference, status: b.status, scheduledStart: b.scheduledStart?.toISOString() ?? null, scheduledEnd: b.scheduledEnd?.toISOString() ?? null,
    serviceName: b.lead?.service.name ?? "—", serviceSlug: b.lead?.service.slug ?? null, leadId: b.leadId,
    address: `${b.address.line1}${b.address.line2 ? ", " + b.address.line2 : ""}, ${b.address.city}, ${b.address.state} ${b.address.zip}`,
    total, paid, balance: total === null ? null : Math.max(0, total - paid),
    payments: b.payments.map((p) => ({ id: p.id, amount: p.amount, status: p.status, kind: p.kind, method: p.method, proofUrl: p.proofUrl, createdAt: p.createdAt.toISOString() })),
    history: b.statusHistory.map((h) => ({ status: h.toStatus, note: h.note, createdAt: h.createdAt.toISOString() })),
  };
}

const CANCEL_CUTOFF_HOURS = 24;

export async function cancelMyBooking(customerId: string, bookingId: string, reason?: string): Promise<Result<{ lateCancellation: boolean }>> {
  const b = await db().booking.findFirst({ where: { id: bookingId, customerId, deletedAt: null }, include: { customer: true } });
  if (!b) return { ok: false, error: "Not found" };
  if (["CANCELLED", "COMPLETED", "IN_PROGRESS"].includes(b.status)) return { ok: false, error: `A ${b.status.toLowerCase().replace("_", " ")} booking can't be cancelled online — please call us` };
  const late = !!b.scheduledStart && b.scheduledStart.getTime() - Date.now() < CANCEL_CUTOFF_HOURS * 3600_000;
  await db().booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
  await db().bookingStatusHistory.create({ data: { bookingId, fromStatus: b.status, toStatus: "CANCELLED", note: `Cancelled by customer${late ? ` (inside ${CANCEL_CUTOFF_HOURS}h of start)` : ""}${reason ? `: ${reason.slice(0, 300)}` : ""}` } });
  if (reason?.trim()) await db().clientNote.create({ data: { customerId, bookingId, leadId: b.leadId, body: reason.trim().slice(0, 2000), kind: "CANCELLATION", authorName: `${b.customer.firstName} ${b.customer.lastName}`.trim() } });
  await notifyAdmins("BOOKING_CANCELLED", `Booking cancelled by ${b.customer.firstName} ${b.customer.lastName}`.trim(), `${b.reference}${late ? " — LATE (under 24h)" : ""}${reason ? ` — ${reason.slice(0, 100)}` : ""}`, `/admin/bookings/${bookingId}`);
  return { ok: true, lateCancellation: late };
}

/** Customer picks a new open slot; it goes back to REQUESTED so the business re-approves it. */
export async function requestReschedule(customerId: string, bookingId: string, slotStartISO: string, slotEndISO: string, reason?: string): Promise<Result> {
  const b = await db().booking.findFirst({ where: { id: bookingId, customerId, deletedAt: null }, include: { lead: { include: { service: true } }, customer: true } });
  if (!b) return { ok: false, error: "Not found" };
  if (["CANCELLED", "COMPLETED", "IN_PROGRESS"].includes(b.status)) return { ok: false, error: "This booking can't be rescheduled online" };
  const slug = b.lead?.service.slug;
  if (!slug || !(serviceIds as readonly string[]).includes(slug)) return { ok: false, error: "Please contact us to reschedule this service" };
  const start = new Date(slotStartISO);
  const end = new Date(slotEndISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return { ok: false, error: "Invalid time" };

  const dateISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
  const slots = await getAvailableSlots(slug as (typeof serviceIds)[number], dateISO, await getPricingConfig());
  if (!slots.some((s) => s.startISO === start.toISOString() && s.endISO === end.toISOString())) return { ok: false, error: "That time isn't available — please pick another" };
  if ((await findConflicts(start, end, bookingId)).length > 0) return { ok: false, error: "That time was just taken — please pick another" };

  await db().booking.update({ where: { id: bookingId }, data: { scheduledStart: start, scheduledEnd: end, status: "REQUESTED" } });
  const label = start.toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  await db().bookingStatusHistory.create({ data: { bookingId, fromStatus: b.status, toStatus: "REQUESTED", note: `Customer requested a new time: ${label}${reason ? ` — ${reason.slice(0, 300)}` : ""}` } });
  await db().clientNote.create({ data: { customerId, bookingId, leadId: b.leadId, kind: "RESCHEDULE_REQUEST", body: `Asked to move to ${label}.${reason ? ` ${reason.slice(0, 500)}` : ""}`, authorName: `${b.customer.firstName} ${b.customer.lastName}`.trim() } });
  await notifyAdmins("BOOKING_REQUESTED", `Reschedule requested: ${b.customer.firstName} ${b.customer.lastName}`.trim(), `${b.reference} → ${label}`, `/admin/bookings/${bookingId}`);
  return { ok: true };
}
