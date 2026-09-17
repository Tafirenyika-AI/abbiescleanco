import { NextRequest, NextResponse } from "next/server";
import { reviewSubmissionSchema } from "@/lib/validation/review";
import { submitReview } from "@/lib/server/reviews";
import { sendEmail } from "@/lib/server/email";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { business } from "@/lib/data/business";
import { notifyAdmins } from "@/lib/server/notificationStore";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`review:${ip}`, 5, 30 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  // Honeypot: bots fill every field, including this hidden one. Look successful, do nothing.
  if (parsed.data._gotcha) {
    return NextResponse.json({ ok: true });
  }

  await submitReview(parsed.data);

  await notifyAdmins(
    "REVIEW_RECEIVED",
    `New review: ${parsed.data.rating}★ from ${parsed.data.authorName}`,
    parsed.data.quote.slice(0, 120),
    "/admin/reviews"
  );

  // Reviews are never auto-published — this just lets the business know one came in.
  await sendEmail({
    to: business.email,
    subject: `New review submitted — ${parsed.data.rating}★ from ${parsed.data.authorName}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2>New review awaiting approval</h2>
        <p><strong>${"★".repeat(parsed.data.rating)}${"☆".repeat(5 - parsed.data.rating)}</strong></p>
        <p><strong>${parsed.data.authorName}</strong>${parsed.data.location ? ` — ${parsed.data.location}` : ""}</p>
        <p>${parsed.data.quote.replace(/</g, "&lt;")}</p>
        <p style="color:#4a5a6a;font-size:13px">Review it in the admin dashboard before it appears on the site.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
