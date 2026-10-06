import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { sendCustomerSms } from "@/lib/server/sms";
import { business } from "@/lib/data/business";

const schema = z.object({ to: z.string().trim().min(7) });

/** An admin sending a test message to a number of their own choosing -- not a customer-care send,
 *  so it bypasses consent (there's nothing to consent to) but still goes through the real provider
 *  dispatch + SMS_ENABLED safety gate, exactly like every other send. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a real phone number" }, { status: 400 });

  const result = await sendCustomerSms({
    to: parsed.data.to,
    body: `Test message from your ${business.name} admin dashboard, sent to confirm your SMS setup works.`,
    category: "test",
    bypassConsentCheck: true,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
