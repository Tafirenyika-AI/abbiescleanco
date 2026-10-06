import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizePhone } from "@/lib/server/sms/phone";
import { SMS_TEMPLATES } from "@/lib/server/sms/templates";
import { getSmsProvider } from "@/lib/server/sms/provider";
import { MockSMSProvider } from "@/lib/server/sms/mockProvider";
import { TelnyxSMSProvider } from "@/lib/server/sms/telnyxProvider";
import { TwilioSMSProvider } from "@/lib/server/sms/twilioProvider";

describe("normalizePhone", () => {
  it("normalizes a bare 10-digit US number", () => {
    expect(normalizePhone("5095551234")).toBe("+15095551234");
  });
  it("normalizes a formatted US number", () => {
    expect(normalizePhone("(509) 555-1234")).toBe("+15095551234");
  });
  it("normalizes an 11-digit number already starting with 1", () => {
    expect(normalizePhone("15095551234")).toBe("+15095551234");
  });
  it("trusts an already-E.164 number", () => {
    expect(normalizePhone("+15095551234")).toBe("+15095551234");
  });
  it("returns null for something that isn't confidently a phone number", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("SMS_TEMPLATES -- deterministic, no AI", () => {
  it("renders STOP exactly, with no leftover {{placeholders}}", () => {
    const text = SMS_TEMPLATES.stop();
    expect(text).toContain("unsubscribed");
    expect(text).toContain("Abbie's Clean Method LLC");
    expect(text).not.toMatch(/\{\{/);
  });
  it("renders START with the required disclosure elements", () => {
    const text = SMS_TEMPLATES.start();
    expect(text).toContain("HELP");
    expect(text).toContain("frequency may vary");
    expect(text).toContain("data rates may apply");
    expect(text).toContain("not a condition of purchase");
    expect(text).toContain("STOP");
  });
  it("renders HELP with real contact info, no placeholders left", () => {
    const text = SMS_TEMPLATES.help();
    expect(text).not.toMatch(/\{\{/);
    expect(text).toMatch(/\(\d{3}\)/); // a real phone number got interpolated in
  });
  it("renders booking confirmation with the real date/time interpolated", () => {
    const text = SMS_TEMPLATES.bookingConfirmation({ date: "Friday, Oct 10", time: "2:00 PM" });
    expect(text).toContain("Friday, Oct 10");
    expect(text).toContain("2:00 PM");
    expect(text).toContain("STOP to opt out");
  });
});

describe("getSmsProvider -- the SMS_ENABLED safety gate", () => {
  const originalEnabled = process.env.SMS_ENABLED;
  const originalProvider = process.env.SMS_PROVIDER;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.SMS_ENABLED;
    else process.env.SMS_ENABLED = originalEnabled;
    if (originalProvider === undefined) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = originalProvider;
  });

  it("falls back to the mock provider when SMS_ENABLED is unset", async () => {
    delete process.env.SMS_ENABLED;
    const provider = await getSmsProvider();
    expect(provider).toBeInstanceOf(MockSMSProvider);
  });

  it("falls back to the mock provider when SMS_ENABLED is anything other than the literal string \"true\"", async () => {
    process.env.SMS_ENABLED = "yes";
    expect(await getSmsProvider()).toBeInstanceOf(MockSMSProvider);
    process.env.SMS_ENABLED = "TRUE";
    expect(await getSmsProvider()).toBeInstanceOf(MockSMSProvider);
    process.env.SMS_ENABLED = "false";
    expect(await getSmsProvider()).toBeInstanceOf(MockSMSProvider);
  });

  it("uses Telnyx by default once SMS_ENABLED=true", async () => {
    process.env.SMS_ENABLED = "true";
    delete process.env.SMS_PROVIDER;
    const provider = await getSmsProvider();
    expect(provider).toBeInstanceOf(TelnyxSMSProvider);
  });

  it("switches to Twilio when SMS_PROVIDER=twilio, still gated on SMS_ENABLED", async () => {
    process.env.SMS_ENABLED = "true";
    process.env.SMS_PROVIDER = "twilio";
    const provider = await getSmsProvider();
    expect(provider).toBeInstanceOf(TwilioSMSProvider);
  });
});

describe("secrets never reach the browser bundle", () => {
  const clientFiles = [
    "src/components/shared/SmsConsentDisclosure.tsx",
    "src/components/estimate/EstimateWizard.tsx",
    "src/components/estimate/PhotoEstimator.tsx",
    "src/components/contact/ContactForm.tsx",
    "src/components/account/AccountProfileForm.tsx",
  ];

  for (const file of clientFiles) {
    it(`${file} never imports a server-only SMS/integration module`, () => {
      const full = path.join(process.cwd(), file);
      expect(fs.existsSync(full)).toBe(true);
      const content = fs.readFileSync(full, "utf8");
      expect(content).not.toMatch(/from ["']@\/lib\/server\/sms/);
      expect(content).not.toMatch(/from ["']@\/lib\/server\/integrationSettings/);
      expect(content).not.toMatch(/TELNYX_API_KEY|TWILIO_AUTH_TOKEN/);
    });
  }
});
