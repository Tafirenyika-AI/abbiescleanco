import { prisma, isDatabaseConfigured } from "@/lib/db";
import { createAdminBooking, getBookingById } from "@/lib/server/bookingStore";
import { createInvoiceFromQuote } from "@/lib/server/invoiceStore";
import { createPaymentLinkForInvoices } from "@/lib/server/invoicePaymentLinkStore";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Test payments require DATABASE_URL to be configured.");
  return prisma;
}

const TEST_CUSTOMER_EMAIL = "test-payment@internal.abbiescleanco";
// A fixed, long-past slot, far outside any real scheduling window -- avoids any chance of
// colliding with a genuine booking's conflict check (which only looks at active, non-completed
// bookings anyway, but there's no reason to risk it) and reads clearly as a placeholder.
const TEST_SLOT_START = "2020-01-15T11:00:00.000Z";
const TEST_SLOT_END = "2020-01-15T11:30:00.000Z";

/** One reusable "Test Payment" customer, created once -- repeated tests reuse it instead of
 *  cluttering the real customer list with a new fake person every time. */
async function getOrCreateTestCustomer(): Promise<string> {
  const existing = await db().customer.findFirst({ where: { email: TEST_CUSTOMER_EMAIL } });
  if (existing) return existing.id;
  const created = await db().customer.create({
    data: {
      firstName: "Test",
      lastName: "Payment (admin tool -- safe to delete)",
      email: TEST_CUSTOMER_EMAIL,
      phone: "0000000000",
      notes:
        "Auto-created by the 'Test a payment' tool on the Invoices page, to verify the real Stripe payment-link pipeline with a small real charge before sending links to actual clients. Safe to delete, along with any test bookings/invoices under it.",
    },
  });
  return created.id;
}

export interface TestPaymentResult {
  ok: boolean;
  error?: string;
  url?: string;
  invoiceId?: string;
}

/**
 * Runs a small real charge through the exact same pipeline a real client invoice uses --
 * createAdminBooking (completed-job quick-create) -> createInvoiceFromQuote -> a real Stripe
 * Payment Link -- so paying it with a real card genuinely proves the whole chain (Stripe
 * connection, the webhook, payment recording, the invoice flipping to PAID) works, not just that
 * Stripe itself is reachable. The admin deletes the resulting test invoice afterward from its own
 * page (the real "Delete" button already built for this), same as any invoice.
 */
export async function createTestPaymentLink(amountCents: number): Promise<TestPaymentResult> {
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 10000) {
    return { ok: false, error: "Test amount must be between $1 and $100." };
  }

  const customerId = await getOrCreateTestCustomer();
  const booking = await createAdminBooking({
    customerId,
    serviceSlug: "test-payment",
    serviceName: "Test payment (admin tool)",
    amount: amountCents,
    addressLine1: "123 Test St",
    city: "Spokane Valley",
    state: "WA",
    zip: "99216",
    scheduledStart: TEST_SLOT_START,
    scheduledEnd: TEST_SLOT_END,
    alreadyCompleted: true,
  });
  if (!booking.ok) return { ok: false, error: booking.error };

  const bookingDetail = await getBookingById(booking.id);
  if (!bookingDetail?.quoteId) return { ok: false, error: "Couldn't create the test booking's quote." };

  const invoice = await createInvoiceFromQuote(bookingDetail.quoteId, {
    bookingId: booking.id,
    notes: "TEST invoice -- created by the 'Test a payment' tool to verify Stripe before sending real client links. Safe to delete once confirmed.",
  });
  if (!invoice.ok || !invoice.id) return { ok: false, error: invoice.error || "Couldn't create the test invoice." };

  const link = await createPaymentLinkForInvoices([invoice.id]);
  if (!link.ok || !link.url) return { ok: false, error: link.error || "Couldn't create the payment link." };

  return { ok: true, url: link.url, invoiceId: invoice.id };
}
