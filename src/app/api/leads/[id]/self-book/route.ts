import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSelfServiceBooking } from "@/lib/server/bookingStore";
import { sendEmail, bookingRequestReceivedEmail } from "@/lib/server/email";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { checkRateLimit } from "@/lib/server/rateLimit";

const schema = z.object({
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  scheduledStart: z.string().trim().min(1),
  scheduledEnd: z.string().trim().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await checkRateLimit(`self-book:${ip}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests. Please try again shortly." }, { status: 429 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await createSelfServiceBooking(id, parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  const scheduledStartLabel = new Date(parsed.data.scheduledStart).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const { subject, html } = bookingRequestReceivedEmail({
    firstName: result.customerName.split(" ")[0] || "there",
    reference: result.reference,
    serviceName: result.serviceName,
    scheduledStartLabel,
  });
  await sendEmail({ to: result.customerEmail, subject, html });

  await notifyAdmins(
    "BOOKING_REQUESTED",
    `Booking requested: ${result.customerName}`,
    `${result.serviceName} — ${scheduledStartLabel}`,
    `/admin/bookings/${result.id}`
  );

  return NextResponse.json({ ok: true, reference: result.reference });
}
