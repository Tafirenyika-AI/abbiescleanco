import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getQuoteById, updateDraftQuote, deleteQuote } from "@/lib/server/quoteStore";

const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().int().min(0),
});

const updateSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
  discount: z.coerce.number().int().min(0).optional(),
  tax: z.coerce.number().int().min(0).optional(),
  deposit: z.coerce.number().int().min(0).optional(),
  expiresAt: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const quote = await getQuoteById(id);
  if (!quote) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ ok: true, quote });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await updateDraftQuote(id, parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const success = await deleteQuote(id);
  if (!success) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
