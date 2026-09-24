import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { getProfile } from "@/lib/server/accounts";
import { saveCustomerMedia, prepareImageForAnalysis, MediaError, sniffMedia } from "@/lib/server/mediaUpload";
import { runPhotoEstimate, savePhotoEstimate, type PhotoServiceId } from "@/lib/server/photoEstimate";
import { isSameOrigin } from "@/lib/server/customerContext";

const MAX_PHOTOS = 6;

const fieldsSchema = z.object({
  areaType: z.string().trim().min(1).max(60),
  propertyType: z.enum(["apartment", "house", "townhome"]),
  squareFeet: z.coerce.number().int().min(100).max(20000),
  bedrooms: z.coerce.number().int().min(0).max(15),
  bathrooms: z.coerce.number().int().min(0).max(15),
  hasPets: z.enum(["true", "false"]).transform((v) => v === "true"),
  service: z.string().optional(),
  _gotcha: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Cross-site request blocked" }, { status: 403 });
  // Each call can cost real money (vision model), so this is much tighter than the form limiter.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await checkRateLimit(`photo-estimate:${ip}`, 4, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "You've run several photo estimates, please try again in a few minutes." }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload" }, { status: 400 });
  }

  const parsed = fieldsSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Please check the details you entered", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data._gotcha) return NextResponse.json({ ok: false, error: "Could not process request" }, { status: 400 });

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ ok: false, error: "Add at least one photo" }, { status: 400 });
  if (files.length > MAX_PHOTOS) return NextResponse.json({ ok: false, error: `Up to ${MAX_PHOTOS} photos at a time` }, { status: 400 });

  try {
    const images: { base64: string }[] = [];
    const urls: string[] = [];
    for (const f of files) {
      const head = Buffer.from(await f.slice(0, 16).arrayBuffer());
      if (sniffMedia(head)?.kind !== "IMAGE") throw new MediaError("Photo estimates need photos (JPG, PNG, WEBP or HEIC), videos can be added to your request afterwards.");
      const prepared = await prepareImageForAnalysis(f);
      if (!prepared) throw new MediaError("We couldn't read one of those photos.");
      images.push({ base64: prepared.base64 });
      urls.push((await saveCustomerMedia(f)).url);
    }

    const requested = parsed.data.service as PhotoServiceId | undefined;
    const result = await runPhotoEstimate({
      images,
      areaType: parsed.data.areaType,
      propertyType: parsed.data.propertyType,
      squareFeet: parsed.data.squareFeet,
      bedrooms: parsed.data.bedrooms,
      bathrooms: parsed.data.bathrooms,
      hasPets: parsed.data.hasPets,
      requestedService: requested,
    });

    const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
    const profile = session ? await getProfile(session.userId) : null;
    const id = await savePhotoEstimate({ customerId: profile?.customer?.id, imageUrls: urls, areaType: parsed.data.areaType, result });

    // Full assessment, including supplies/staffNotes — the customer reviews and approves this
    // exact content before it's ever shared with the crew (see reviewPhotoEstimate).
    return NextResponse.json({
      ok: true,
      photoEstimateId: id,
      mode: result.mode,
      notice: result.notice,
      service: result.service,
      condition: result.condition,
      addOns: result.addOns,
      requiresManualQuote: result.requiresManualQuote,
      low: result.low,
      high: result.high,
      hoursLow: result.hoursLow,
      hoursHigh: result.hoursHigh,
      breakdown: result.breakdown,
      findings: result.analysis?.findings ?? [],
      supplies: result.analysis?.supplies ?? [],
      staffNotes: result.analysis?.staffNotes ?? "",
    });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Something went wrong analysing your photos. Please try again." }, { status: 500 });
  }
}
