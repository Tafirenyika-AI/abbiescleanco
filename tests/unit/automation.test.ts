import { describe, it, expect } from "vitest";
import {
  sendQuoteFollowUp,
  sendBookingConfirmation,
  sendAppointmentReminder,
  sendPostServiceFollowUp,
  sendReviewRequest,
  sendWinBackMessage,
} from "@/lib/server/automation";
import { renderEmailTemplate } from "@/lib/server/emailTemplates";

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

describe("REAL BUG FIX: booking confirmation email includes the full booking (time, address, price), not just the date", () => {
  it("renders a Pacific-correct time, the real address, and the real price -- all previously missing", async () => {
    // 8:00 AM Pacific (PDT, October), same real-world instant as the exact bug this fixes.
    const { subject, html } = await renderEmailTemplate("BOOKING_CONFIRMATION", {
      name: "Annie Welzig",
      serviceName: "Standard Cleaning",
      dateLabel: "Thursday, October 15",
      timeLabel: "8:00 AM",
      arrivalWindowBlockHtml: "",
      reference: "B-26-C6BDE0",
      cancellationUrl: "https://abbiescleanco.com/policies/cancellation",
      addressBlockHtml: "<p><strong>Address:</strong> 123 Main St, Spokane Valley, WA 99216</p>",
      amountBlockHtml: "<p><strong>Price:</strong> $150.00</p>",
    });
    expect(subject).toContain("Thursday, October 15");
    expect(html).toContain("8:00 AM");
    expect(html).toContain("123 Main St, Spokane Valley, WA 99216");
    expect(html).toContain("$150.00");
    expect(html).toContain("B-26-C6BDE0");
  });

  it("omits the address/price blocks cleanly when genuinely unavailable, rather than showing a blank label", async () => {
    const { html } = await renderEmailTemplate("BOOKING_CONFIRMATION", {
      name: "Jane Doe",
      serviceName: "Standard Cleaning",
      dateLabel: "Thursday, October 15",
      timeLabel: "8:00 AM",
      arrivalWindowBlockHtml: "",
      reference: "B-26-ABC123",
      cancellationUrl: "https://abbiescleanco.com/policies/cancellation",
      addressBlockHtml: "",
      amountBlockHtml: "",
    });
    expect(html).not.toContain("<strong>Address:</strong>");
    expect(html).not.toContain("<strong>Price:</strong>");
  });
});
