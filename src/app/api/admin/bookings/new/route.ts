import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createAdminBooking } from "@/lib/server/bookingStore";
import { getService } from "@/lib/data/services";
import { serviceIds } from "@/lib/validation/quote";

const schema = z.object({
  customerId: z.string().min(1),
  service: z.enum(serviceIds),
  amount: z.coerce.number().int().min(1),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(20).optional(),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  scheduledStart: z.string().min(1),
  scheduledEnd: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const service = getService(parsed.data.service);
  if (!service) return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });

  const result = await createAdminBooking({
    customerId: parsed.data.customerId,
    serviceSlug: parsed.data.service,
    serviceName: service.name,
    amount: parsed.data.amount,
    addressLine1: parsed.data.addressLine1,
    addressLine2: parsed.data.addressLine2,
    city: parsed.data.city,
    state: parsed.data.state,
    zip: parsed.data.zip,
    scheduledStart: parsed.data.scheduledStart,
    scheduledEnd: parsed.data.scheduledEnd,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
