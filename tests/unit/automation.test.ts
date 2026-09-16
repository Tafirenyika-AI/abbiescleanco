import { describe, it, expect } from "vitest";
import {
  sendQuoteFollowUp,
  sendBookingConfirmation,
  sendAppointmentReminder,
  sendPostServiceFollowUp,
  sendReviewRequest,
  sendWinBackMessage,
} from "@/lib/server/automation";

const recipient = { name: "Jane Doe", email: "jane@example.com", phone: "5095551234", smsConsent: true };

describe("automation message functions (mock adapters, no live credentials)", () => {
  it("sendQuoteFollowUp succeeds via the mock email adapter", async () => {
    const result = await sendQuoteFollowUp(recipient, "ACM-26-ABC123");
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("mock");
  });

  it("sendBookingConfirmation succeeds", async () => {
    const result = await sendBookingConfirmation(recipient, {
      serviceName: "Standard Cleaning",
      scheduledStart: new Date(),
      reference: "ACM-26-ABC123",
    });
    expect(result.ok).toBe(true);
  });

  it("sendAppointmentReminder emails and, with consent, texts", async () => {
    const results = await sendAppointmentReminder(recipient, {
      serviceName: "Deep Cleaning",
      scheduledStart: new Date(),
      stage: "24h",
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("sendPostServiceFollowUp and sendReviewRequest succeed", async () => {
    expect((await sendPostServiceFollowUp(recipient)).ok).toBe(true);
    expect((await sendReviewRequest(recipient, "https://g.page/r/example/review")).ok).toBe(true);
  });

  it("sendWinBackMessage succeeds", async () => {
    expect((await sendWinBackMessage(recipient)).ok).toBe(true);
  });
});
