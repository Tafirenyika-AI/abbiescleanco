import { NextRequest, NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/validation/quote";
import { calculateEstimate } from "@/lib/pricing";
import { getService } from "@/lib/data/services";
import { createLead, findRecentDuplicate } from "@/lib/server/leadStore";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { sendEmail, customerConfirmationEmail, businessNotificationEmail } from "@/lib/server/email";
import { sendSms } from "@/lib/server/sms";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { scheduleQuoteFollowUps } from "@/lib/server/automationStore";
import { business, whatsappLink } from "@/lib/data/business";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { getProfile } from "@/lib/server/accounts";
import { linkPhotoEstimateToLead } from "@/lib/server/photoEstimate";
import { prisma } from "@/lib/db";

async function getLeadCustomerId(leadId: string): Promise<string | null> {
  if (!prisma) return null;
  const l = await prisma.lead.findUnique({ where: { id: leadId }, select: { customerId: true } });
  return l?.customerId ?? null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await checkRateLimit(`quote:${ip}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Honeypot: bots fill every field, including this hidden one. Still returns a
  // normal-looking 200 (not a 400) so a bot can't tell it was caught -- but
  // deliberately omits `estimate`/`leadId`, so the client must handle this as
  // a distinct case rather than assuming every `ok:true` response has them.
  if (input._gotcha) {
    return NextResponse.json({ ok: true, reference: "REJECTED", rejected: true }, { status: 200 });
  }

  // If the submitter is already logged in, tie this request to their existing
  // account instead of creating a disconnected guest record -- otherwise it
  // would never show up in their own /account history.
  const customerSession = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  const loggedInProfile = customerSession ? await getProfile(customerSession.userId) : null;
  const loggedInCustomerId = loggedInProfile?.customer?.id;

  const service = getService(input.service);
  if (!service) {
    return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });
  }

  const duplicateReference = await findRecentDuplicate(input);
  if (duplicateReference) {
    return NextResponse.json({
      ok: true,
      reference: duplicateReference,
      duplicate: true,
      message: "We already have a recent request from you — no need to resubmit.",
    });
  }

  const pricingConfig = await getPricingConfig();
  const estimate = calculateEstimate(
    {
      service: input.service,
      propertyType: input.propertyType,
      squareFeet: input.squareFeet,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      condition: input.condition,
      frequency: input.frequency,
      hasPets: input.hasPets,
      addOns: input.addOns,
    },
    pricingConfig
  );

  const { id: leadId, reference } = await createLead(input, estimate, loggedInCustomerId);

  if (input.photoEstimateId) {
    const created = await getLeadCustomerId(leadId);
    if (created) await linkPhotoEstimateToLead(input.photoEstimateId, leadId, created);
  }

  await scheduleQuoteFollowUps(leadId);

  const estimateLabel = estimate.requiresManualQuote
    ? "Manual quote required — we'll follow up after reviewing your property details."
    : `$${estimate.totalLow}–$${estimate.totalHigh} (preliminary)`;

  await sendEmail({
    to: input.email,
    ...customerConfirmationEmail({
      firstName: input.firstName,
      reference,
      serviceName: service.name,
      estimateLabel,
    }),
  });

  await sendEmail({
    to: business.email,
    replyTo: input.email,
    ...businessNotificationEmail({
      reference,
      name: `${input.firstName} ${input.lastName}`,
      phone: input.phone,
      email: input.email,
      serviceName: service.name,
      estimateLabel,
      preferredContactMethod: input.preferredContactMethod,
      zip: input.zip,
    }),
  });

  if (input.smsConsent) {
    await sendSms(
      input.phone,
      `Abbie's Clean Method: We received your ${service.name} request (${reference}). We'll follow up shortly to confirm details. Reply STOP to opt out.`
    );
  }

  await notifyAdmins(
    "NEW_LEAD",
    `New lead: ${input.firstName} ${input.lastName}`,
    `${service.name} — ${estimateLabel}`,
    "/admin/leads"
  );

  const whatsappSummary = [
    `Hi Abbie's Clean Method! I just requested an estimate.`,
    `Reference: ${reference}`,
    `Service: ${service.name}`,
    `Estimate: ${estimateLabel}`,
    `Name: ${input.firstName} ${input.lastName}`,
  ].join("\n");

  return NextResponse.json({
    ok: true,
    leadId,
    reference,
    estimate,
    serviceId: input.service,
    whatsappHandoffUrl: whatsappLink(whatsappSummary),
  });
}
