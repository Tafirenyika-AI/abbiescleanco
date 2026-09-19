import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { saveCustomerMedia, MediaError } from "@/lib/server/mediaUpload";
import { addClientAttachment } from "@/lib/server/clientPortalStore";

export async function POST(req: NextRequest) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  // JSON branch: registers a video that the browser already uploaded straight to Vercel Blob.
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { url?: string; mimeType?: string; sizeBytes?: number; leadId?: string; bookingId?: string; caption?: string } | null;
    if (!body?.url || !/^video\/(mp4|quicktime|webm)$/.test(body.mimeType ?? "")) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    const res = await addClientAttachment(
      ctx.customerId,
      { leadId: body.leadId || undefined, bookingId: body.bookingId || undefined },
      { url: body.url, kind: "VIDEO", mimeType: body.mimeType!, sizeBytes: Math.max(0, Number(body.sizeBytes) || 0), caption: body.caption?.trim() || undefined },
      `${ctx.firstName} ${ctx.lastName}`.trim()
    );
    return NextResponse.json(res, { status: res.ok ? 200 : 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  const leadId = (form.get("leadId") as string) || undefined;
  const bookingId = (form.get("bookingId") as string) || undefined;
  const caption = ((form.get("caption") as string) || "").trim() || undefined;
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  if (!leadId && !bookingId) return NextResponse.json({ ok: false, error: "Missing target" }, { status: 400 });

  try {
    const media = await saveCustomerMedia(file);
    const res = await addClientAttachment(ctx.customerId, { leadId, bookingId }, { ...media, caption }, `${ctx.firstName} ${ctx.lastName}`.trim());
    return NextResponse.json(res, { status: res.ok ? 200 : 404 });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
