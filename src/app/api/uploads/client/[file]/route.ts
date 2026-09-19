import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * Serves customer media that was saved to local disk (the no-Vercel-Blob fallback). Next.js only
 * serves files that existed in public/ at build time, so runtime uploads need their own route.
 * The filename is strictly validated (32 hex chars + known extension), so no path traversal.
 */
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^[a-f0-9]{32}\.(jpg|png|webp|mp4|mov|webm)$/.exec(file);
  if (!m) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "uploads", "client", file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[m[1]],
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
}
