import { listLeads, getLeadById, getLeadByReference, updateLeadStatus, leadStatusLabels, type LeadStatusValue } from "@/lib/server/leadStore";
import { listQuotes } from "@/lib/server/quoteStore";
import { listBookingsInRange, listBookings } from "@/lib/server/bookingStore";
import { listBookingsAwaitingPayment } from "@/lib/server/paymentStore";
import { getReportsSummary } from "@/lib/server/reportsStore";
import { allNavItems } from "@/lib/admin/nav";

/**
 * Abbie Assistant -- the blueprint's "Abbie Chat, level 1, 2 & 3": a typed, deterministic navigator,
 * a small set of real, server-authorized data lookups, and a small set of real actions that require
 * an explicit second confirmation step before anything is written. Deliberately NOT a model call for
 * any of this -- per the blueprint's own cost-engineering rule ("do not make an AI call for
 * navigation with known route... lead deduplication"), every one of these is answerable/actionable
 * exactly, instantly, and for free with keyword matching + real database calls. No model, no
 * hallucination risk, no cost, and no action ever executes on the same request that proposed it --
 * see resolveAssistantAction in this file, which the confirm step calls separately.
 */

export interface UpdateLeadStatusAction {
  kind: "update_lead_status";
  leadId: string;
  reference: string;
  toStatus: LeadStatusValue;
  statusLabel: string;
}

export type AssistantAction = UpdateLeadStatusAction;

export interface AssistantResult {
  type: "navigate" | "answer" | "confirm" | "unknown";
  text: string;
  href?: string;
  action?: AssistantAction;
}

const REFERENCE_RE = /\b([a-z]{2,5}-\d{2}-[a-f0-9]{6})\b/i;

// Keyword phrases an admin might type, mapped to a real LeadStatusValue -- longer/more specific
// phrases first so "estimate sent" matches before a hypothetical looser "sent".
const STATUS_KEYWORDS: [string, LeadStatusValue][] = [
  ["awaiting customer", "AWAITING_CUSTOMER"],
  ["estimate sent", "ESTIMATE_SENT"],
  ["quote sent", "ESTIMATE_SENT"],
  ["in progress", "IN_PROGRESS"],
  ["contacted", "CONTACTED"],
  ["confirmed", "CONFIRMED"],
  ["scheduled", "SCHEDULED"],
  ["completed", "COMPLETED"],
  ["cancelled", "CANCELLED"],
  ["canceled", "CANCELLED"],
  ["lost", "LOST"],
  ["new", "NEW"],
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

interface Tool {
  match: (q: string) => boolean;
  run: (q: string) => Promise<AssistantResult>;
}

const tools: Tool[] = [
  {
    match: (q) => /\b(mark|set|change)\b/.test(q) && REFERENCE_RE.test(q),
    run: async (q) => {
      const refMatch = q.match(REFERENCE_RE);
      if (!refMatch) return { type: "unknown", text: `I couldn't find a reference number in that — try something like "mark ACM-26-4F3A9C as contacted".` };
      const lead = await getLeadByReference(refMatch[1]);
      if (!lead) return { type: "answer", text: `I couldn't find a lead with reference ${refMatch[1].toUpperCase()}.`, href: "/admin/leads" };
      const statusEntry = STATUS_KEYWORDS.find(([phrase]) => q.includes(phrase));
      if (!statusEntry) {
        return {
          type: "answer",
          text: `I found ${lead.reference} (${lead.input.firstName} ${lead.input.lastName}), but I'm not sure what status you want — try contacted, confirmed, scheduled, completed, cancelled, or lost.`,
          href: "/admin/leads",
        };
      }
      const [, toStatus] = statusEntry;
      if (lead.status === toStatus) {
        return { type: "answer", text: `${lead.reference} is already marked ${leadStatusLabels[toStatus]}.`, href: "/admin/leads" };
      }
      return {
        type: "confirm",
        text: `Mark ${lead.reference} (${lead.input.firstName} ${lead.input.lastName}) as ${leadStatusLabels[toStatus]}?`,
        action: { kind: "update_lead_status", leadId: lead.id, reference: lead.reference, toStatus, statusLabel: leadStatusLabels[toStatus] },
      };
    },
  },
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

const EXAMPLE_QUERIES = ["new leads", "pipeline value", "conversion rate", "overdue payments", "bookings this week", "mark ACM-26-4F3A9C as contacted"];

export async function resolveAssistantQuery(rawQuery: string): Promise<AssistantResult> {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { type: "unknown", text: `Try asking: ${EXAMPLE_QUERIES.join(", ")} — or type a page name to jump there.` };

  for (const tool of tools) {
    if (tool.match(q)) return tool.run(q);
  }

  const navMatch = allNavItems.find((item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
  if (navMatch) {
    return navMatch.built
      ? { type: "navigate", text: `Opening ${navMatch.label}…`, href: navMatch.href }
      : { type: "answer", text: `${navMatch.label} isn't built yet — here's what's planned for it.`, href: navMatch.href };
  }

  return { type: "unknown", text: `I don't have an answer for that yet. Try: ${EXAMPLE_QUERIES.join(", ")}.` };
}

/**
 * Executes a previously-proposed action, after the admin has explicitly confirmed it in the UI.
 * Never called from resolveAssistantQuery itself -- the confirm step always re-validates against
 * the current database state rather than trusting whatever the client sends back, since time may
 * have passed (or someone else may have already changed the lead) between propose and confirm.
 */
export async function executeAssistantAction(action: AssistantAction, adminUserId: string): Promise<{ ok: true; text: string; href?: string } | { ok: false; error: string }> {
  if (action.kind === "update_lead_status") {
    const current = await getLeadById(action.leadId);
    if (!current) return { ok: false, error: "That lead no longer exists." };
    if (current.status === action.toStatus) return { ok: true, text: `${current.reference} is already ${action.statusLabel}.`, href: "/admin/leads" };
    const updated = await updateLeadStatus(action.leadId, { status: action.toStatus }, adminUserId);
    if (!updated) return { ok: false, error: "Couldn't update that lead — it may have been deleted." };
    return { ok: true, text: `${updated.reference} marked ${action.statusLabel}.`, href: "/admin/leads" };
  }
  return { ok: false, error: "Unknown action." };
}
