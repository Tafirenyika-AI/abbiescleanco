import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listDocuments, createDocument, DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from "@/lib/server/documentStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_DOCUMENTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const documents = await listDocuments({
    category: category && (DOCUMENT_CATEGORIES as readonly string[]).includes(category) ? (category as (typeof DOCUMENT_CATEGORIES)[number]) : undefined,
    status: status && (DOCUMENT_STATUSES as readonly string[]).includes(status) ? (status as (typeof DOCUMENT_STATUSES)[number]) : undefined,
    search: search || undefined,
  });
  return NextResponse.json({ ok: true, documents });
}

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  reference: z.string().trim().max(100).nullable().optional(),
  counterpartyName: z.string().trim().max(200).nullable().optional(),
  effectiveDate: z.string().trim().max(40).nullable().optional(),
  expirationDate: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  correspondenceLog: z.string().trim().max(20000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_DOCUMENTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await createDocument({ ...parsed.data, createdById: admin.id });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
