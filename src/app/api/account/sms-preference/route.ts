import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { requireCustomer } from "@/lib/server/customerContext";
import { recordSmsConsentEvent } from "@/lib/server/sms";

const schema = z.object({ smsConsent: z.boolean() });

/** Customer-care SMS only -- deliberately separate from any future marketing-SMS preference (see
 *  CommunicationPreference.smsMarketingConsent), never toggled together. */
export async function PATCH(req: NextRequest) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });
  if (!isDatabaseConfigured || !prisma) return NextResponse.json({ ok: false, error: "Unavailable" }, { status: 503 });

  const customer = await prisma.customer.findUnique({ where: { id: auth.ctx.customerId }, select: { phone: true } });
  if (!customer) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });

  await recordSmsConsentEvent({
    customerId: auth.ctx.customerId,
    phone: customer.phone,
    purpose: "customer_care",
    status: parsed.data.smsConsent ? "opted_in" : "opted_out",
    method: "website_form",
    source: "account_settings",
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
