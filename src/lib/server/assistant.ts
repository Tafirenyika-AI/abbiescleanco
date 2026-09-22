import { listLeads } from "@/lib/server/leadStore";
import { listQuotes } from "@/lib/server/quoteStore";
import { listBookingsInRange, listBookings } from "@/lib/server/bookingStore";
import { listBookingsAwaitingPayment } from "@/lib/server/paymentStore";
import { getReportsSummary } from "@/lib/server/reportsStore";
import { allNavItems } from "@/lib/admin/nav";

/**
 * Abbie Assistant -- the blueprint's "Abbie Chat, level 1 & 2": a typed, deterministic navigator
 * plus a small set of real, server-authorized data lookups. Deliberately NOT a model call for any
 * of this -- per the blueprint's own cost-engineering rule ("do not make an AI call for navigation
 * with known route... lead deduplication"), every one of these is answerable exactly, instantly,
 * and for free by querying the real database, so that's what it does. No model, no hallucination
 * risk, no cost. A model-backed "level 3" (propose/execute actions) is real future scope, not this.
 */

export interface AssistantResult {
  type: "navigate" | "answer" | "unknown";
  text: string;
  href?: string;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

interface Tool {
  match: (q: string) => boolean;
  run: (q: string) => Promise<AssistantResult>;
}

const tools: Tool[] = [
  {
    match: (q) => /\b(new lead|new leads)\b/.test(q),
    run: async () => {
      const leads = await listLeads();
      const n = leads.filter((l) => l.status === "NEW").length;
      return { type: "answer", text: `You have ${n} new lead${n === 1 ? "" : "s"} awaiting first contact.`, href: "/admin/leads" };
    },
  },
  {
    match: (q) => /pipeline/.test(q),
    run: async () => {
      const quotes = await listQuotes();
      const sent = quotes.filter((q2) => q2.status === "SENT");
      const total = sent.reduce((sum, q2) => sum + q2.total, 0);
      return { type: "answer", text: `Pipeline value is ${money(total)}, across ${sent.length} quote${sent.length === 1 ? "" : "s"} awaiting a decision.`, href: "/admin/quotes" };
    },
  },
  {
    match: (q) => /conversion/.test(q),
    run: async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const report = await getReportsSummary(start, end);
      const pct = report.conversionRate != null ? `${Math.round(report.conversionRate * 100)}%` : "not enough data yet";
      return { type: "answer", text: `Lead-to-accepted-quote conversion over the last 30 days is ${pct}.`, href: "/admin/reports" };
    },
  },
  {
    match: (q) => /(net revenue|revenue)/.test(q),
    run: async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const report = await getReportsSummary(start, end);
      return { type: "answer", text: `Net revenue over the last 30 days is ${money(report.netRevenue)} (accepted quotes minus expenses).`, href: "/admin/reports" };
    },
  },
  {
    match: (q) => /(overdue|unpaid|owe|awaiting payment)/.test(q),
    run: async () => {
      const awaiting = await listBookingsAwaitingPayment();
      return {
        type: "answer",
        text: awaiting.length === 0 ? "Nothing's outstanding — every confirmed booking is paid in full." : `${awaiting.length} booking${awaiting.length === 1 ? "" : "s"} still owe${awaiting.length === 1 ? "s" : ""} a balance.`,
        href: "/admin/payments",
      };
    },
  },
  {
    match: (q) => /(today|this week).*(booking|job)|booking.*(today|this week)/.test(q),
    run: async (q) => {
      const now = new Date();
      const end = /today/.test(q) ? new Date(new Date(now).setHours(23, 59, 59, 999)) : new Date(now.getTime() + 7 * 86400000);
      const bookings = await listBookingsInRange(now.toISOString(), end.toISOString());
      const label = /today/.test(q) ? "today" : "in the next 7 days";
      return { type: "answer", text: `${bookings.length} booking${bookings.length === 1 ? "" : "s"} ${label}.`, href: "/admin/bookings" };
    },
  },
  {
    match: (q) => /(unassigned|no cleaner|not assigned)/.test(q),
    run: async () => {
      const bookings = await listBookings();
      const unassigned = bookings.filter((b) => !b.staffAssignee && !["CANCELLED", "COMPLETED"].includes(b.status));
      return { type: "answer", text: `${unassigned.length} upcoming booking${unassigned.length === 1 ? "" : "s"} ${unassigned.length === 1 ? "has" : "have"} no cleaner assigned.`, href: "/admin/bookings" };
    },
  },
];

const EXAMPLE_QUERIES = ["new leads", "pipeline value", "conversion rate", "overdue payments", "bookings this week"];

export async function resolveAssistantQuery(rawQuery: string): Promise<AssistantResult> {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { type: "unknown", text: `Try asking: ${EXAMPLE_QUERIES.join(", ")} — or type a page name to jump there.` };

  for (const tool of tools) {
    if (tool.match(q)) return tool.run(q);
  }

  const navMatch = allNavItems.find((item) => item.built && (item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)));
  if (navMatch) return { type: "navigate", text: `Opening ${navMatch.label}…`, href: navMatch.href };

  return { type: "unknown", text: `I don't have an answer for that yet. Try: ${EXAMPLE_QUERIES.join(", ")}.` };
}
