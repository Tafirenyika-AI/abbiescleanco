import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getCustomerById, updateCustomerNotes, deleteCustomer } from "@/lib/server/customerStore";

const updateSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  petsNote: z.string().trim().max(500).optional(),
  accessInstructions: z.string().trim().max(1000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const customer = await getCustomerById(id);
  if (!customer) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ ok: true, customer });
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

  await updateCustomerNotes(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await deleteCustomer(id, admin.id);
  if (!deleted) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
