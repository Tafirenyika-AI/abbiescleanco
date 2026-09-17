import { describe, it, expect } from "vitest";
import { quoteRequestSchema } from "@/lib/validation/quote";
import { contactSchema } from "@/lib/validation/contact";

const validQuote = {
  zip: "99206",
  propertyType: "house",
  squareFeet: 1500,
  bedrooms: 3,
  bathrooms: 2,
  service: "standard-cleaning",
  frequency: "one-time",
  condition: "normal",
  hasPets: false,
  addOns: [],
  firstName: "Jane",
  lastName: "Doe",
  phone: "5095551234",
  email: "jane@example.com",
  preferredContactMethod: "EMAIL",
  smsConsent: false,
  emailConsent: true,
  policiesAccepted: true,
  _gotcha: "",
};

describe("quoteRequestSchema", () => {
  it("accepts a valid submission", () => {
    const result = quoteRequestSchema.safeParse(validQuote);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid ZIP code", () => {
    const result = quoteRequestSchema.safeParse({ ...validQuote, zip: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = quoteRequestSchema.safeParse({ ...validQuote, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects when policies are not accepted", () => {
    const result = quoteRequestSchema.safeParse({ ...validQuote, policiesAccepted: false });
    expect(result.success).toBe(false);
  });

  it("still parses a filled honeypot field (the route handler screens it, not the schema)", () => {
    // Intentional: rejecting it here would return a validation-error 400 that
    // tips a bot off. The API route checks this field after parsing and
    // returns an innocuous-looking success response instead — see
    // src/app/api/quote/route.ts and the corresponding integration test.
    const result = quoteRequestSchema.safeParse({ ...validQuote, _gotcha: "http://spam.example" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown service id", () => {
    const result = quoteRequestSchema.safeParse({ ...validQuote, service: "not-a-real-service" });
    expect(result.success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("accepts a valid message", () => {
    const result = contactSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      message: "I'd like a quote for my apartment.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short message", () => {
    const result = contactSchema.safeParse({ name: "Jane", email: "jane@example.com", message: "hi" });
    expect(result.success).toBe(false);
  });
});
