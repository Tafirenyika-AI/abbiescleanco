import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { sendEmail } from "@/lib/server/email";
import { business } from "@/lib/data/business";

const schema = z.object({ to: z.string().trim().email() });

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a real email address" }, { status: 400 });

  const result = await sendEmail({
    to: parsed.data.to,
    subject: `Test email from ${business.name}`,
    html: `<p>This is a real test email from your ${business.name} admin dashboard, sent to confirm your email setup works.</p>`,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
