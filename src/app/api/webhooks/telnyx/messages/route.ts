import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { verifyTelnyxSignature } from "@/lib/server/sms/telnyxWebhook";
import { recordSmsConsentEvent, findCustomerByPhone, sendCustomerSms, SMS_TEMPLATES, normalizePhone } from "@/lib/server/sms";
import { notifyAdmins } from "@/lib/server/notificationStore";

/**
 * Telnyx inbound-message + delivery-status webhook. Must stay fast and fully synchronous/
 * deterministic -- no LLM call belongs anywhere in this handler. Real AI-assisted replies are a
 * later phase (see docs/TELNYX_10DLC_SETUP.md); this only logs the message and alerts an admin.
 */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured || !prisma) return NextResponse.json({ ok: false, error: "Unavailable" }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");
  const verified = await verifyTelnyxSignature(rawBody, signature, timestamp);
  if (!verified) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });

  let event: TelnyxWebhookBody;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = event?.data?.id;
  const eventType = event?.data?.event_type;
  if (!eventId || !eventType) return NextResponse.json({ ok: false, error: "Malformed event" }, { status: 400 });

  // Idempotency: Telnyx (like most webhook providers) may redeliver the same event. The unique
  // (provider, eventId) constraint makes this an atomic "claim" -- if another request already
  // claimed it, this insert throws and we return 200 without reprocessing.
  try {
    await prisma.webhookEvent.create({ data: { provider: "telnyx", eventId, eventType, payload: event as object } });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const payload = event.data.payload;

  if (eventType === "message.received") {
    await handleInbound(payload);
  } else if (eventType.startsWith("message.")) {
    await handleDeliveryStatus(payload);
  }

  return NextResponse.json({ ok: true });
}

const STOP_KEYWORDS = ["STOP", "UNSUBSCRIBE"];
const START_KEYWORDS = ["START", "YES"];
const HELP_KEYWORDS = ["HELP"];

async function handleInbound(payload: TelnyxMessagePayload | undefined) {
  if (!payload) return;
  const fromPhone = normalizePhone(payload.from?.phone_number ?? "") ?? payload.from?.phone_number ?? "unknown";
  const toPhone = payload.to?.[0]?.phone_number ?? "unknown";
  const text = (payload.text ?? "").trim();
  const keyword = text.toUpperCase();

  const customer = await findCustomerByPhone(fromPhone);

  await prisma!.message.create({
    data: {
      customerId: customer?.id ?? null,
      channel: "SMS",
      body: text,
      toAddress: toPhone,
      fromAddress: fromPhone,
      direction: "IN",
      category: STOP_KEYWORDS.includes(keyword) ? "stop" : START_KEYWORDS.includes(keyword) ? "start" : HELP_KEYWORDS.includes(keyword) ? "help" : "customer_reply",
      provider: "telnyx",
      providerMessageId: payload.id ? `in_${payload.id}` : undefined,
      status: "received",
    },
  });

  if (STOP_KEYWORDS.includes(keyword)) {
    await recordSmsConsentEvent({ customerId: customer?.id, phone: fromPhone, purpose: "customer_care", status: "opted_out", method: "keyword", source: "sms_keyword" });
    await recordSmsConsentEvent({ customerId: customer?.id, phone: fromPhone, purpose: "marketing", status: "opted_out", method: "keyword", source: "sms_keyword" });
    // The one exception to "never send to an opted-out number" -- carriers require exactly one
    // confirmation reply to a STOP.
    await sendCustomerSms({ to: fromPhone, body: SMS_TEMPLATES.stop(), category: "stop", customerId: customer?.id, bypassConsentCheck: true });
    return;
  }

  if (START_KEYWORDS.includes(keyword)) {
    await recordSmsConsentEvent({ customerId: customer?.id, phone: fromPhone, purpose: "customer_care", status: "opted_in", method: "keyword", source: "sms_keyword" });
    await sendCustomerSms({ to: fromPhone, body: SMS_TEMPLATES.start(), category: "start", customerId: customer?.id, bypassConsentCheck: true });
    return;
  }

  if (HELP_KEYWORDS.includes(keyword)) {
    await sendCustomerSms({ to: fromPhone, body: SMS_TEMPLATES.help(), category: "help", customerId: customer?.id, bypassConsentCheck: true });
    return;
  }

  // Any other inbound text: acknowledge immediately (deterministic, no AI) and alert an admin.
  // Real AI-assisted replies are intentionally not wired up yet -- see docs/TELNYX_10DLC_SETUP.md.
  await sendCustomerSms({ to: fromPhone, body: SMS_TEMPLATES.supportAck(), category: "support_ack", customerId: customer?.id, bypassConsentCheck: true });
  await notifyAdmins("NEW_MESSAGE", `New SMS from ${fromPhone}`, text.slice(0, 140), "/admin/sms");
}

async function handleDeliveryStatus(payload: TelnyxMessagePayload | undefined) {
  if (!payload?.id) return;
  const status = payload.to?.[0]?.status;
  if (!status) return;

  const data: { status: string; deliveredAt?: Date; failedAt?: Date; errorCode?: string } = { status };
  if (status === "delivered") data.deliveredAt = new Date();
  if (status === "delivery_failed" || status === "failed") {
    data.failedAt = new Date();
    data.errorCode = payload.errors?.[0]?.code;
  }

  await prisma!.message.updateMany({ where: { providerMessageId: payload.id }, data });
}

interface TelnyxMessagePayload {
  id?: string;
  text?: string;
  from?: { phone_number?: string };
  to?: { phone_number?: string; status?: string }[];
  errors?: { code?: string; title?: string }[];
}

interface TelnyxWebhookBody {
  data: {
    id: string;
    event_type: string;
    payload?: TelnyxMessagePayload;
  };
}
