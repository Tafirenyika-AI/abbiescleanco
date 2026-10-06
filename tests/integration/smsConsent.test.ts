import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.setConfig({ testTimeout: 15000 });

// Same scoped-env-loading pattern as quoteStore.test.ts -- see that file's own comment for why.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath) && !process.env.DATABASE_URL) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

const { prisma, isDatabaseConfigured } = await import("@/lib/db");
const { recordSmsConsentEvent, hasSmsConsent, findCustomerByPhone } = await import("@/lib/server/sms/consent");
const { sendCustomerSms } = await import("@/lib/server/sms/send");

const run = Date.now();
const maybeDescribe = isDatabaseConfigured ? describe : describe.skip;

maybeDescribe("SMS consent -- the defensible audit trail", () => {
  let customerId: string;
  const phone = `+1509555${String(run).slice(-4)}`;

  beforeAll(async () => {
    if (!prisma) throw new Error("DATABASE_URL not configured for this test run");
    const customer = await prisma.customer.create({
      data: { firstName: "Consent", lastName: `Test${run}`, phone, email: `consent-test-${run}@test.internal` },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (customerId) {
      await prisma.message.deleteMany({ where: { customerId } }).catch(() => {});
      await prisma.smsConsentEvent.deleteMany({ where: { customerId } }).catch(() => {});
      await prisma.communicationPreference.deleteMany({ where: { customerId } }).catch(() => {});
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    }
  });

  it("defaults to no consent before any event is recorded", async () => {
    expect(await hasSmsConsent({ customerId, purpose: "customer_care" })).toBe(false);
  });

  it("recording an opt-in event flips the current-state flag, and is itself preserved as history", async () => {
    await recordSmsConsentEvent({ customerId, phone, purpose: "customer_care", status: "opted_in", method: "website_form", source: "quote" });
    expect(await hasSmsConsent({ customerId, purpose: "customer_care" })).toBe(true);

    const events = await prisma!.smsConsentEvent.findMany({ where: { customerId } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("opted_in");
    expect(events[0].disclosureVersion).toBeTruthy();
  });

  it("a later opt-out is a NEW event, never an edit of the prior one -- both rows survive", async () => {
    await recordSmsConsentEvent({ customerId, phone, purpose: "customer_care", status: "opted_out", method: "keyword", source: "sms_keyword" });
    expect(await hasSmsConsent({ customerId, purpose: "customer_care" })).toBe(false);

    const events = await prisma!.smsConsentEvent.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });
    expect(events).toHaveLength(2);
    expect(events[0].status).toBe("opted_in");
    expect(events[1].status).toBe("opted_out");
  });

  it("marketing and customer-care consent are architected separately -- opting one in never opts the other in", async () => {
    await recordSmsConsentEvent({ customerId, phone, purpose: "customer_care", status: "opted_in", method: "website_form", source: "quote" });
    expect(await hasSmsConsent({ customerId, purpose: "customer_care" })).toBe(true);
    expect(await hasSmsConsent({ customerId, purpose: "marketing" })).toBe(false);
  });

  it("findCustomerByPhone resolves a normalized phone back to the right customer (for inbound webhook handling)", async () => {
    const found = await findCustomerByPhone(phone);
    expect(found?.id).toBe(customerId);
  });

  it("REAL BUG FOUND IN LIVE VERIFICATION: matches regardless of how the stored phone is formatted -- real production rows are stored as raw digits, \"(555) 555-1234\", etc., not consistently normalized, so an exact-string match silently failed to find the customer, meaning a STOP never actually reached CommunicationPreference", async () => {
    const digitsOnly = phone.replace(/\D/g, "").slice(-10); // what's stored on `customerId`'s row is +1XXXXXXXXXX
    const differentlyFormattedCustomer = await prisma!.customer.create({
      data: { firstName: "Format", lastName: `Mismatch${run}`, phone: `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`, email: `format-mismatch-${run}@test.internal` },
    });
    try {
      // Telnyx always sends E.164 for an inbound sender -- confirm that still resolves even though
      // the stored row looks nothing like it.
      const found = await findCustomerByPhone(`+1${digitsOnly}`);
      expect(found?.id).toBe(differentlyFormattedCustomer.id);
    } finally {
      await prisma!.customer.delete({ where: { id: differentlyFormattedCustomer.id } }).catch(() => {});
    }
  });

  it("sendCustomerSms refuses to send to a number with no consent on file, and still logs the attempt", async () => {
    const noConsentPhone = `+1509555${String(run + 1).slice(-4)}`;
    const result = await sendCustomerSms({ to: noConsentPhone, body: "test", category: "test" });
    expect(result.ok).toBe(false);
    expect(result.mode).toBe("skipped");
    expect(result.reason).toBe("not_consented");

    const logged = await prisma!.message.findFirst({ where: { toAddress: noConsentPhone }, orderBy: { createdAt: "desc" } });
    expect(logged?.status).toBe("skipped");
    await prisma!.message.deleteMany({ where: { toAddress: noConsentPhone } });
  });

  it("sendCustomerSms proceeds (in mock mode, since SMS_ENABLED isn't \"true\" in this test run) once consent is on file", async () => {
    const result = await sendCustomerSms({ to: phone, body: "test booking confirmation", category: "test", customerId });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("mock");

    const logged = await prisma!.message.findUnique({ where: { id: result.messageId } });
    expect(logged?.status).toBe("sent");
    expect(logged?.provider).toBe("mock");
    expect(logged?.direction).toBe("OUT");
  });

  it("STOP's bypassConsentCheck lets the one required confirmation reply through even after opt-out", async () => {
    await recordSmsConsentEvent({ customerId, phone, purpose: "customer_care", status: "opted_out", method: "keyword", source: "sms_keyword" });
    expect(await hasSmsConsent({ customerId, purpose: "customer_care" })).toBe(false);

    const result = await sendCustomerSms({ to: phone, body: "You are unsubscribed.", category: "stop", customerId, bypassConsentCheck: true });
    expect(result.ok).toBe(true);
  });
});

maybeDescribe("Webhook idempotency", () => {
  const eventId = `test-event-${run}`;

  afterAll(async () => {
    if (!prisma) return;
    await prisma.webhookEvent.deleteMany({ where: { provider: "telnyx", eventId } }).catch(() => {});
  });

  it("the same (provider, eventId) can only be claimed once", async () => {
    if (!prisma) throw new Error("DATABASE_URL not configured for this test run");
    await prisma.webhookEvent.create({ data: { provider: "telnyx", eventId, eventType: "message.received" } });

    await expect(
      prisma.webhookEvent.create({ data: { provider: "telnyx", eventId, eventType: "message.received" } })
    ).rejects.toThrow();
  });

  it("a different event type for the SAME underlying message is a distinct, allowed event (delivery-status transitions aren't duplicates)", async () => {
    if (!prisma) throw new Error("DATABASE_URL not configured for this test run");
    const sentEventId = `test-sent-${run}`;
    const deliveredEventId = `test-delivered-${run}`;
    await prisma.webhookEvent.create({ data: { provider: "telnyx", eventId: sentEventId, eventType: "message.sent" } });
    await prisma.webhookEvent.create({ data: { provider: "telnyx", eventId: deliveredEventId, eventType: "message.finalized" } });
    await prisma.webhookEvent.deleteMany({ where: { provider: "telnyx", eventId: { in: [sentEventId, deliveredEventId] } } });
  });
});
