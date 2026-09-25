import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Serves files stored in the database (see StoredFile in schema.prisma). The id is a 32-hex
 * randomUUID set by the app at create time -- unguessable, so this can be a plain public GET
 * with no auth check, matching how Vercel Blob URLs worked before this replaced them.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id) || !isDatabaseConfigured || !prisma) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ ok: false }, { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
