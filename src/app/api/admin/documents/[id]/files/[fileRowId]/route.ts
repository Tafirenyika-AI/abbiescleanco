import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { deleteDocumentFile } from "@/lib/server/documentStore";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fileRowId: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_DOCUMENTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { fileRowId } = await params;
  const result = await deleteDocumentFile(fileRowId);
  return NextResponse.json(result);
}
