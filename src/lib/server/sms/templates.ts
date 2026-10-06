import { business } from "@/lib/data/business";

/**
 * Deterministic, plain-string SMS templates -- no AI involved. Routine transactional messages
 * (confirmations, reminders, STOP/START/HELP) must render the same way every time; an LLM call for
 * any of these would be unnecessary latency/cost and a compliance risk (the 10DLC campaign was
 * reviewed against this exact wording).
 */

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export const SMS_TEMPLATES = {
  bookingConfirmation: (vars: { date: string; time: string }) =>
    render("{{business}}: Your cleaning service is confirmed for {{date}} at {{time}}. Reply to this message if you need assistance. Reply STOP to opt out.", { business: business.name, ...vars }),

  reminder: (vars: { date: string; time: string }) =>
    render("{{business}}: Reminder: your cleaning service is scheduled for {{date}} at {{time}}. Reply if you need assistance. Reply STOP to opt out.", { business: business.name, ...vars }),

  scheduleUpdate: (vars: { date: string; time: string }) =>
    render("{{business}}: Your cleaning service schedule has been updated to {{date}} at {{time}}. Reply if you have any questions. Reply STOP to opt out.", { business: business.name, ...vars }),

  arrivalUpdate: () =>
    render("{{business}}: Good news -- your cleaner is on the way!", { business: business.name }) + " Reply STOP to opt out.",

  serviceCompleted: () =>
    render("{{business}}: Your cleaning service has been completed. Thank you for choosing {{shortName}}. Reply STOP to opt out.", { business: business.name, shortName: business.name.replace(" LLC", "") }),

  supportAck: () =>
    render("{{business}}: We received your message and a member of our team will assist you shortly. Reply STOP to opt out.", { business: business.name }),

  help: () =>
    render("{{business}}: For help, contact us at {{phone}} or {{email}}. Reply STOP to opt out.", { business: business.name, phone: business.phoneDisplay, email: business.email }),

  stop: () =>
    render("{{business}}: You are unsubscribed and will receive no further SMS messages.", { business: business.name }),

  start: () =>
    render(
      "{{business}}: Thanks for subscribing to customer care text messages! Reply HELP for help. Message frequency may vary. Msg & data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out.",
      { business: business.name }
    ),

  invoicePaymentNotice: (vars: { amount: string }) =>
    render("{{business}}: Your invoice for {{amount}} is ready. Reply if you have any questions. Reply STOP to opt out.", { business: business.name, ...vars }),
} as const;
