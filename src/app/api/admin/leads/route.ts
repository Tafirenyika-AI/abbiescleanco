import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createLead } from "@/lib/server/leadStore";
import { calculateEstimate } from "@/lib/pricing";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { getService } from "@/lib/data/services";
import { serviceIds } from "@/lib/validation/quote";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(20),
  service: z.enum(serviceIds),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  propertyType: z.enum(["apartment", "house", "townhome", "commercial"]),
  squareFeet: z.coerce.number().int().min(100).max(20000),
  bedrooms: z.coerce.number().int().min(0).max(15),
  bathrooms: z.coerce.number().int().min(0).max(15),
  condition: z.enum(["light", "normal", "heavy", "very-heavy"]),
  frequency: z.enum(["one-time", "weekly", "biweekly", "every-4-weeks", "custom"]),
  hasPets: z.boolean().default(false),
  additionalInstructions: z.string().trim().max(2000).optional(),
});

/** Admin-side "New Lead" quick-create -- for a phone-in or walk-in customer who didn't go through the public estimate form. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;

  const service = getService(input.service);
  if (!service) return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });

  const pricingConfig = await getPricingConfig();
  const estimate = calculateEstimate(
    {
      service: input.service,
      propertyType: input.propertyType,
      squareFeet: input.squareFeet,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      condition: input.condition,
      frequency: input.frequency,
      hasPets: input.hasPets,
      addOns: [],
    },
    pricingConfig
  );

  const { id, reference } = await createLead(
    {
      ...input,
      addOns: [],
      preferredContactMethod: "PHONE",
      smsConsent: false,
      emailConsent: true,
      policiesAccepted: true,
      source: "admin",
    },
    estimate
  );

  return NextResponse.json({ ok: true, id, reference });
}
