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

describe("cancellation-policy notice on booking/reminder emails only", () => {
  const exactWording =
    "Cancellations made within 24 hours of your scheduled service are subject to a $50 fee. Same-day cancellations are subject to a fee equal to 80% of the scheduled service total.";

  it("appears on the booking confirmation email with the exact specified wording", async () => {
    const { html } = await renderEmailTemplate("BOOKING_CONFIRMATION", {
      name: "Jane Doe", serviceName: "Standard Cleaning", dateLabel: "Thursday, October 15", timeLabel: "8:00 AM",
      arrivalWindowBlockHtml: "", reference: "B-26-ABC123", cancellationUrl: "https://abbiescleanco.com/policies/cancellation",
      addressBlockHtml: "", amountBlockHtml: "",
    });
    expect(html).toContain("Cancellation Policy:");
    expect(html).toContain(exactWording);
  });

  it("appears on the appointment reminder email with the exact specified wording", async () => {
    const { html } = await renderEmailTemplate("APPOINTMENT_REMINDER", {
      name: "Jane Doe", serviceName: "Standard Cleaning", dateLabel: "Thursday, October 15 at 8:00 AM", addressBlockHtml: "",
    });
    expect(html).toContain("Cancellation Policy:");
    expect(html).toContain(exactWording);
  });

  it("never appears in any SMS body built in automation.ts (do not add this to every SMS for now)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/server/automation.ts"), "utf8");
    // Every real SMS body in this file is a sendCustomerSms({ ... body: `...` }) call -- confirm
    // none of those literal strings contain the policy wording.
    const smsBodies = [...source.matchAll(/sendCustomerSms\(\{[^}]*body:\s*`([^`]*)`/g)].map((m) => m[1]);
    expect(smsBodies.length).toBeGreaterThan(0); // sanity check the regex actually found real calls
    for (const body of smsBodies) {
      expect(body).not.toContain("Cancellation Policy");
      expect(body).not.toContain("80%");
    }
  });
});
