import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { scheduleTurnover } from "@/lib/server/propertyManagerStore";
import { getService } from "@/lib/data/services";
import { serviceIds } from "@/lib/validation/quote";

const schema = z.object({
  addressId: z.string().trim().min(1),
  service: z.enum(serviceIds),
  amount: z.coerce.number().int().min(1),
  scheduledStart: z.string().min(1),
  scheduledEnd: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const service = getService(parsed.data.service);
  if (!service) return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });

  const result = await scheduleTurnover({
    customerId: id,
    addressId: parsed.data.addressId,
    serviceSlug: parsed.data.service,
    serviceName: service.name,
    amount: parsed.data.amount,
    scheduledStart: parsed.data.scheduledStart,
    scheduledEnd: parsed.data.scheduledEnd,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
