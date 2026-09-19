import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireCustomer } from "@/lib/server/customerContext";
import { MAX_VIDEO_BYTES } from "@/lib/server/mediaUpload";

/**
 * Direct-to-Blob upload token, used for videos: Vercel serverless functions cap request bodies at
 * ~4.5MB, so large files can't pass through our API. Only signed-in customers get a token, and it
 * is restricted to video types and a size cap. Returns 501 when Blob isn't configured (local dev),
 * and the client falls back to the multipart route.
 */
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: "Direct upload not configured" }, { status: 501 });
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"],
        maximumSizeInBytes: MAX_VIDEO_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ customerId: auth.ctx.customerId }),
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ ok: false, error: "Could not start upload" }, { status: 400 });
  }
}
