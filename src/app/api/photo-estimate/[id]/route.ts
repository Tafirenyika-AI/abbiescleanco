import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/customerContext";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { reviewPhotoEstimate } from "@/lib/server/photoEstimate";

const schema = z.object({
  approved: z.boolean(),
  customerNotes: z.string().trim().max(2000).optional(),
});

/**
 * Records the customer's approve/edit decision on their own photo assessment before it's
 * shared with the crew. No customer login is required (the photo-estimate flow itself is
 * unauthenticated), same trust model as the rest of this flow: the id is an unguessable cuid
 * handed only to the browser that uploaded the photos.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Cross-site request blocked" }, { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`photo-estimate-review:${ip}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests — please try again shortly." }, { status: 429 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const ok = await reviewPhotoEstimate(id, parsed.data.approved, parsed.data.customerNotes);
  if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
