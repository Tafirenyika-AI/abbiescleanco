import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateCustomerAddress } from "@/lib/server/customerStore";

const addressSchema = z.object({
  label: z.string().trim().max(100).nullable().optional(),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(20),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  propertyType: z.enum(["apartment", "house", "townhome", "commercial"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id, addressId } = await params;

  const parsed = addressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await updateCustomerAddress(
    id,
    addressId,
    { label: parsed.data.label ?? null, line1: parsed.data.line1, line2: parsed.data.line2 ?? null, city: parsed.data.city, state: parsed.data.state, zip: parsed.data.zip, propertyType: parsed.data.propertyType },
    admin.id
  );
  return NextResponse.json(result, { status: result.ok ? 200 : result.error === "Address not found" ? 404 : 400 });
}
