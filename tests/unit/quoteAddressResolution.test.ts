import { describe, it, expect } from "vitest";
import { formatAddressLine, hasRealAddressLine, resolveServiceAddress, resolveCompanyName } from "@/lib/server/quoteStore";

const PLACEHOLDER = { line1: "Provided at booking confirmation", line2: null, city: "Spokane Valley", state: "WA", zip: "99216", label: null };
const REAL_LEAD_ADDRESS = { line1: "1005 N Evergreen Rd", line2: "Ste 101", city: "Spokane Valley", state: "WA", zip: "99216", label: "Spokane Dentures and Implants" };
const REAL_BOOKING_ADDRESS = { line1: "1005 N Evergreen Rd", line2: "Ste 101", city: "Spokane Valley", state: "WA", zip: "99216", label: null };

describe("hasRealAddressLine", () => {
  it("rejects the known intake placeholder", () => {
    expect(hasRealAddressLine("Provided at booking confirmation")).toBe(false);
  });
  it("rejects empty/whitespace", () => {
    expect(hasRealAddressLine("")).toBe(false);
    expect(hasRealAddressLine("   ")).toBe(false);
    expect(hasRealAddressLine(null)).toBe(false);
    expect(hasRealAddressLine(undefined)).toBe(false);
  });
  it("accepts a real street line", () => {
    expect(hasRealAddressLine("1005 N Evergreen Rd")).toBe(true);
  });
});

describe("formatAddressLine", () => {
  it("never renders the placeholder as if it were a real address", () => {
    expect(formatAddressLine(PLACEHOLDER)).toBeNull();
  });
  it("formats a real address with line2", () => {
    expect(formatAddressLine(REAL_LEAD_ADDRESS)).toBe("1005 N Evergreen Rd, Ste 101, Spokane Valley, WA 99216");
  });
  it("formats a real address with no line2", () => {
    expect(formatAddressLine({ ...REAL_LEAD_ADDRESS, line2: null })).toBe("1005 N Evergreen Rd, Spokane Valley, WA 99216");
  });
  it("returns null for a missing address", () => {
    expect(formatAddressLine(null)).toBeNull();
    expect(formatAddressLine(undefined)).toBeNull();
  });
});

describe("resolveServiceAddress -- priority order", () => {
  it("CRITICAL: never presents the intake placeholder as a real address, falls through to null instead", () => {
    const result = resolveServiceAddress({ bookingAddresses: [], leadAddress: PLACEHOLDER, customerAddresses: [] });
    expect(result).toBeNull();
  });

  it("tier 1: a real confirmed booking address wins over everything else", () => {
    const result = resolveServiceAddress({
      bookingAddresses: [REAL_BOOKING_ADDRESS],
      leadAddress: PLACEHOLDER,
      customerAddresses: [],
    });
    expect(result).toBe("1005 N Evergreen Rd, Ste 101, Spokane Valley, WA 99216");
  });

  it("tier 2: falls back to the lead's own address when it has real content and there's no booking", () => {
    const result = resolveServiceAddress({ bookingAddresses: [], leadAddress: REAL_LEAD_ADDRESS, customerAddresses: [] });
    expect(result).toBe("1005 N Evergreen Rd, Ste 101, Spokane Valley, WA 99216");
  });

  it("tier 2 skips a booking address that itself has no real content", () => {
    const result = resolveServiceAddress({ bookingAddresses: [PLACEHOLDER], leadAddress: REAL_LEAD_ADDRESS, customerAddresses: [] });
    expect(result).toBe("1005 N Evergreen Rd, Ste 101, Spokane Valley, WA 99216");
  });

  it("tier 3: falls back to another real address on the same customer when the lead's own is placeholder", () => {
    const otherAddress = { line1: "500 S Main St", line2: null, city: "Spokane", state: "WA", zip: "99201", label: null };
    const result = resolveServiceAddress({ bookingAddresses: [], leadAddress: PLACEHOLDER, customerAddresses: [otherAddress] });
    expect(result).toBe("500 S Main St, Spokane, WA 99201");
  });

  it("tier 4: genuinely unavailable returns null (caller shows 'Service address not provided')", () => {
    const result = resolveServiceAddress({ bookingAddresses: [], leadAddress: null, customerAddresses: [] });
    expect(result).toBeNull();
  });

  it("tier 4: all placeholders/empty still returns null, never the placeholder text", () => {
    const result = resolveServiceAddress({ bookingAddresses: [PLACEHOLDER], leadAddress: PLACEHOLDER, customerAddresses: [PLACEHOLDER] });
    expect(result).toBeNull();
  });
});

describe("resolveCompanyName", () => {
  it("uses the lead's own address label when present, even if the street address itself is still a placeholder", () => {
    expect(resolveCompanyName(PLACEHOLDER === null ? null : { ...PLACEHOLDER, label: "Spokane Dentures and Implants" }, [])).toBe("Spokane Dentures and Implants");
  });
  it("falls back to a customer address's label when the lead's own has none", () => {
    const labeled = { line1: "x", line2: null, city: "x", state: "x", zip: "x", label: "Acme Corp" };
    expect(resolveCompanyName({ ...PLACEHOLDER, label: null }, [labeled])).toBe("Acme Corp");
  });
  it("returns null when no address anywhere has a label", () => {
    expect(resolveCompanyName(PLACEHOLDER, [])).toBeNull();
  });
});
