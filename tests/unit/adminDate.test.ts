import { describe, it, expect } from "vitest";
import { pacificDateTimeToUtcIso, pacificWallTimeToUtc } from "@/lib/adminDate";

describe("pacificDateTimeToUtcIso -- the booking-creation timezone bug fix", () => {
  it("REAL BUG: an 8:00 AM booking must become 15:00 UTC (PDT, UTC-7), not naive 08:00 UTC -- the naive version read back as 1:00 AM Pacific", () => {
    const iso = pacificDateTimeToUtcIso("2026-10-15", "08:00");
    expect(iso).toBe("2026-10-15T15:00:00.000Z");

    // Confirm it reads back correctly in Pacific, the way the calendar/admin UI will display it
    const readBack = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
    expect(readBack).toBe("8:00 AM");
  });

  it("handles standard time correctly (January, PST = UTC-8, not DST's UTC-7)", () => {
    const iso = pacificDateTimeToUtcIso("2026-01-15", "08:00");
    expect(iso).toBe("2026-01-15T16:00:00.000Z");
  });

  it("round-trips a late-evening time without rolling into the wrong UTC calendar day incorrectly", () => {
    const iso = pacificDateTimeToUtcIso("2026-10-15", "23:00");
    expect(iso).toBe("2026-10-16T06:00:00.000Z"); // 11pm Pacific = 6am UTC the next day
  });
});

describe("pacificWallTimeToUtc", () => {
  it("matches the wrapper's output for the same inputs", () => {
    const direct = pacificWallTimeToUtc(2026, 10, 15, 8, 0);
    expect(direct.toISOString()).toBe(pacificDateTimeToUtcIso("2026-10-15", "08:00"));
  });
});
