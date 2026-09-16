import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/quote/route";

const mockLeadsFile = path.join(process.cwd(), ".data", "leads.json");

function makeRequest(body: unknown, ip = "203.0.113.1") {
  return new NextRequest("http://localhost/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

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
  email: `jane-${Date.now()}@example.com`,
  preferredContactMethod: "EMAIL",
  smsConsent: false,
  emailConsent: true,
  policiesAccepted: true,
  companyWebsite: "",
};

describe("POST /api/quote", () => {
  beforeEach(async () => {
    await fs.rm(mockLeadsFile, { force: true });
  });

  it("stores a valid lead and returns a reference + estimate", async () => {
    const res = await POST(makeRequest(validQuote, "203.0.113.10"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.reference).toMatch(/^ACM-\d{2}-[A-Z0-9]{6}$/);
    expect(json.estimate.requiresManualQuote).toBe(false);
    expect(json.whatsappHandoffUrl).toContain("wa.me");
  });

  it("rejects an invalid submission with a 400", async () => {
    const res = await POST(makeRequest({ ...validQuote, email: "not-an-email" }, "203.0.113.11"));
    expect(res.status).toBe(400);
  });

  it("silently rejects a filled honeypot field", async () => {
    const res = await POST(makeRequest({ ...validQuote, companyWebsite: "http://spam.example" }, "203.0.113.12"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reference).toBe("REJECTED");
  });

  it("detects a duplicate submission within the dedupe window", async () => {
    const email = `dupe-${Date.now()}@example.com`;
    const first = await POST(makeRequest({ ...validQuote, email }, "203.0.113.13"));
    const firstJson = await first.json();

    const second = await POST(makeRequest({ ...validQuote, email }, "203.0.113.14"));
    const secondJson = await second.json();

    expect(secondJson.duplicate).toBe(true);
    expect(secondJson.reference).toBe(firstJson.reference);
  });

  it("rate limits repeated requests from the same IP", async () => {
    const ip = "203.0.113.99";
    let lastStatus = 200;
    for (let i = 0; i < 6; i++) {
      const res = await POST(makeRequest({ ...validQuote, email: `rl-${i}-${Date.now()}@example.com` }, ip));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
