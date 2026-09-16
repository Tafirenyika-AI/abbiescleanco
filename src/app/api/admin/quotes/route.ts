import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listQuotes, createQuote } from "@/lib/server/quoteStore";

const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().int().min(0), // cents
});

const createSchema = z.object({
  leadId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(50),
  discount: z.coerce.number().int().min(0).optional(),
  tax: z.coerce.number().int().min(0).optional(),
  deposit: z.coerce.number().int().min(0).optional(),
  expiresAt: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

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
  const quote = await createQuote(leadId, data);
  return NextResponse.json({ ok: true, id: quote.id });
}
