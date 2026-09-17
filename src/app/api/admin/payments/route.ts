import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listPayments, recordPayment, PAYMENT_STATUSES } from "@/lib/server/paymentStore";
import { getBookingById } from "@/lib/server/bookingStore";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { sendEmail, paymentReceiptEmail } from "@/lib/server/email";

const schema = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().int().min(1), // cents
  kind: z.enum(["deposit", "full_payment"]),
  status: z.enum(PAYMENT_STATUSES),
  proofUrl: z.string().trim().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "VIEW_REPORTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const payments = await listPayments();
  return NextResponse.json({ ok: true, payments });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "VIEW_REPORTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await recordPayment(parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  if (parsed.data.status === "PAID" || parsed.data.status === "FAILED") {
    const booking = await getBookingById(parsed.data.bookingId);
    await notifyAdmins(
      parsed.data.status === "PAID" ? "PAYMENT_RECEIVED" : "PAYMENT_FAILED",
      `Payment ${parsed.data.status === "PAID" ? "received" : "failed"}: $${(parsed.data.amount / 100).toFixed(2)}`,
      booking?.customerName ?? "",
      "/admin/payments"
    );
    if (parsed.data.status === "PAID" && booking?.customerEmail) {
      const { subject, html } = paymentReceiptEmail({
        firstName: booking.customerName.split(" ")[0] || "there",
        amountLabel: `$${(parsed.data.amount / 100).toFixed(2)}`,
        description: `your ${parsed.data.kind === "deposit" ? "deposit" : "payment"} (${booking.reference})`,
        receiptUrl: parsed.data.proofUrl,
      });
      await sendEmail({ to: booking.customerEmail, subject, html });
    }
  }

  return NextResponse.json({ ok: true });
}
