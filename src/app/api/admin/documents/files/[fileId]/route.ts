import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { findDocumentFileByFileId } from "@/lib/server/documentStore";

/** Serves a document vault file -- unlike /api/files/[id] (public, used for logos/posters), this
 *  requires a real admin session, since agreements/insurance/legal paperwork is more sensitive. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_DOCUMENTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { fileId } = await params;
  const meta = await findDocumentFileByFileId(fileId);
  if (!meta || !isDatabaseConfigured || !prisma) return NextResponse.json({ ok: false }, { status: 404 });

  const stored = await prisma.storedFile.findUnique({ where: { id: meta.storedFileId } });
  if (!stored) return NextResponse.json({ ok: false }, { status: 404 });

  return new NextResponse(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": stored.contentType,
      "Content-Length": String(stored.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${meta.filename.replace(/"/g, "")}"`,
    },
  });
}
