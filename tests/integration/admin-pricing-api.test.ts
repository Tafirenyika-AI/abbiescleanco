import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/admin/pricing/route";
import { createSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { defaultPricingConfig } from "@/lib/pricing";

const mockPricingFile = path.join(process.cwd(), ".data", "pricing-config.json");

function makeRequest(method: "GET" | "PUT", body?: unknown, withAuth = true) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withAuth) {
    headers.cookie = `${ADMIN_SESSION_COOKIE}=${createSessionToken("admin@abbiescleanco.com")}`;
  }
  return new NextRequest("http://localhost/api/admin/pricing", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Admin pricing API", () => {
  beforeAll(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-do-not-use-in-prod";
  });

  beforeEach(async () => {
    await fs.rm(mockPricingFile, { force: true });
  });

  it("rejects an unauthenticated GET", async () => {
    const res = await GET(makeRequest("GET", undefined, false));
    expect(res.status).toBe(401);
  });

  it("returns the current config for an authenticated GET", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.config.services["standard-cleaning"].baseLow).toBe(150);
  });

  it("rejects an unauthenticated PUT", async () => {
    const res = await PUT(makeRequest("PUT", defaultPricingConfig, false));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid pricing payload even when authenticated", async () => {
    const invalid = structuredClone(defaultPricingConfig);
    // @ts-expect-error intentionally invalid for the test
    invalid.services["standard-cleaning"].baseLow = "not-a-number-and-also-negative-after-coercion" as unknown;
    const res = await PUT(makeRequest("PUT", { ...invalid, services: { "standard-cleaning": { baseLow: -50 } } }));
    expect(res.status).toBe(400);
  });

  it("saves a valid pricing config when authenticated", async () => {
    const edited = structuredClone(defaultPricingConfig);
    edited.services["standard-cleaning"].baseLow = 175;
    edited.services["standard-cleaning"].baseHigh = 225;

    const putRes = await PUT(makeRequest("PUT", edited));
    expect(putRes.status).toBe(200);

    const saved = JSON.parse(await fs.readFile(mockPricingFile, "utf-8"));
    expect(saved.services["standard-cleaning"].baseLow).toBe(175);
    expect(saved.services["standard-cleaning"].baseHigh).toBe(225);
  });
});
