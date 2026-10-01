import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listQuotes, createQuote } from "@/lib/server/quoteStore";

const PRICING_UNIT_VALUES = ["PER_VISIT", "PER_HOUR", "FLAT_PROJECT", "MONTHLY", "CUSTOM"] as const;
const FREQUENCY_VALUES = ["ONE_TIME", "WEEKLY", "TWICE_WEEKLY", "THREE_WEEKLY", "FIVE_WEEKLY", "CUSTOM"] as const;

const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().int().min(0), // cents
  pricingUnit: z.enum(PRICING_UNIT_VALUES).optional(),
  frequency: z.enum(FREQUENCY_VALUES).optional(),
  customFrequency: z.string().trim().max(200).optional(),
});

const createSchema = z.object({
  leadId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(50),
  discountType: z.enum(["FIXED", "PERCENT"]).optional(),
  discountValue: z.coerce.number().int().min(0).optional(),
  tax: z.coerce.number().int().min(0).optional(),
  depositType: z.enum(["NONE", "FIXED", "PERCENT"]).optional(),
  depositValue: z.coerce.number().int().min(0).optional(),
  expiresAt: z.string().trim().optional(),
  notes: z.string().trim().max(4000).optional(),
  internalNotes: z.string().trim().max(4000).optional(),
  scopeOfService: z.string().trim().max(4000).optional(),
  exclusions: z.string().trim().max(4000).optional(),
  customerMessage: z.string().trim().max(2000).optional(),
  promoCodeId: z.string().trim().optional(),
}).refine((d) => d.discountType !== "PERCENT" || (d.discountValue ?? 0) <= 100, { message: "Percent discount can't exceed 100", path: ["discountValue"] })
  .refine((d) => d.depositType !== "PERCENT" || (d.depositValue ?? 0) <= 100, { message: "Percent deposit can't exceed 100", path: ["depositValue"] });

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const quotes = await listQuotes();
  return NextResponse.json({ ok: true, quotes });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { leadId, ...data } = parsed.data;
  const quote = await createQuote(leadId, data, admin.id);
  return NextResponse.json({ ok: true, id: quote.id });
}
