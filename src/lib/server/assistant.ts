import { listLeads, getLeadById, getLeadByReference, updateLeadStatus, leadStatusLabels, LEAD_STATUSES, type LeadStatusValue } from "@/lib/server/leadStore";
import { listQuotes } from "@/lib/server/quoteStore";
import { listBookingsInRange, listBookings } from "@/lib/server/bookingStore";
import { listBookingsAwaitingPayment } from "@/lib/server/paymentStore";
import { getReportsSummary } from "@/lib/server/reportsStore";
import { allNavItems } from "@/lib/admin/nav";
import { runAgent, type AgentTool } from "@/lib/server/aiAgent";
import { HOUSE_WRITING_STYLE } from "@/lib/aiStyle";

/**
 * Abbie AI -- the blueprint's "Abbie Chat, level 1, 2 & 3": a real, model-backed assistant that
 * understands free-form admin questions and decides which real tool(s) to call, rather than
 * matching fixed keyword phrases. Every fact it states has to come from a tool's real return value
 * -- the tools below are the SAME real, server-authorized data lookups the deterministic version
 * used, just exposed to the model instead of regex-matched. Nothing here executes a WRITE directly:
 * a status change only ever proposes an action (propose_lead_status_change), which the UI shows as
 * an explicit confirm step; the actual write happens in executeAssistantAction, called separately
 * after a human clicks confirm, re-validated against current state -- unchanged from before.
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

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const builtNavItems = allNavItems.filter((i) => i.built);

const tools: AgentTool[] = [
  {
    name: "get_new_leads_count",
    description: "Count of leads currently in NEW status, awaiting first contact.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const leads = await listLeads();
      return { newLeads: leads.filter((l) => l.status === "NEW").length };
    },
  },
  {
    name: "get_pipeline_value",
    description: "Total dollar value of quotes currently SENT (awaiting the customer's decision), and how many.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const quotes = await listQuotes();
      const sent = quotes.filter((q) => q.status === "SENT");
      return { pipelineValue: money(sent.reduce((sum, q) => sum + q.total, 0)), quoteCount: sent.length };
    },
  },
  {
    name: "get_conversion_rate",
    description: "Lead-to-accepted-quote conversion rate over the last 30 days, as a percentage.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const report = await getReportsSummary(start, end);
      return { conversionRatePct: report.conversionRate != null ? Math.round(report.conversionRate * 100) : null };
    },
  },
  {
    name: "get_net_revenue",
    description: "Net revenue (accepted quotes minus expenses) over the last 30 days.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      const report = await getReportsSummary(start, end);
      return { netRevenue: money(report.netRevenue) };
    },
  },
  {
    name: "get_overdue_payments",
    description: "Confirmed bookings that still have a balance owing.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const awaiting = await listBookingsAwaitingPayment();
      return { bookingsOwing: awaiting.length };
    },
  },
  {
    name: "get_bookings_in_range",
    description: "Count of bookings scheduled today or in the next 7 days.",
    input_schema: { type: "object", properties: { range: { type: "string", enum: ["today", "next_7_days"] } }, required: ["range"] },
    run: async (input) => {
      const now = new Date();
      const end = input.range === "today" ? new Date(new Date(now).setHours(23, 59, 59, 999)) : new Date(now.getTime() + 7 * 86400000);
      const bookings = await listBookingsInRange(now.toISOString(), end.toISOString());
      return { count: bookings.length, range: input.range };
    },
  },
  {
    name: "get_unassigned_bookings",
    description: "Upcoming (not cancelled/completed) bookings with no cleaner assigned yet.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const bookings = await listBookings();
      const unassigned = bookings.filter((b) => !b.staffAssignee && !["CANCELLED", "COMPLETED"].includes(b.status));
      return { unassignedCount: unassigned.length };
    },
  },
  {
    name: "find_lead_by_reference",
    description: "Look up a single lead by its reference code (format like ACM-26-4F3A9C) to see its name and current status.",
    input_schema: { type: "object", properties: { reference: { type: "string" } }, required: ["reference"] },
    run: async (input) => {
      const lead = await getLeadByReference(String(input.reference));
      if (!lead) return { found: false };
      return { found: true, reference: lead.reference, name: `${lead.input.firstName} ${lead.input.lastName}`, status: leadStatusLabels[lead.status] };
    },
  },
  {
    name: "propose_lead_status_change",
    description: "Propose changing a lead's status. This does NOT make the change -- it only prepares it for the admin to explicitly confirm in the UI. Always look up the lead first if you don't already know its exact current status.",
    input_schema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "The lead's reference code, e.g. ACM-26-4F3A9C" },
        toStatus: { type: "string", enum: [...LEAD_STATUSES] },
      },
      required: ["reference", "toStatus"],
    },
    run: async (input) => {
      const lead = await getLeadByReference(String(input.reference));
      if (!lead) return { ok: false, error: "No lead found with that reference." };
      const toStatus = input.toStatus as LeadStatusValue;
      if (lead.status === toStatus) return { ok: false, error: `${lead.reference} is already ${leadStatusLabels[toStatus]}.` };
      return {
        ok: true,
        proposedAction: {
          kind: "update_lead_status",
          leadId: lead.id,
          reference: lead.reference,
          toStatus,
          statusLabel: leadStatusLabels[toStatus],
        } satisfies UpdateLeadStatusAction,
        summary: `Mark ${lead.reference} (${lead.input.firstName} ${lead.input.lastName}) as ${leadStatusLabels[toStatus]}`,
      };
    },
  },
  {
    name: "find_admin_page",
    description: "Find an admin dashboard page by name or topic (e.g. 'invoices', 'pricing', 'team'), to answer 'where is X' or to navigate there.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    run: async (input) => {
      const q = String(input.query).toLowerCase();
      const match = allNavItems.find((item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));
      if (!match) return { found: false, availablePages: builtNavItems.map((i) => i.label) };
      return { found: true, label: match.label, href: match.href, built: match.built, description: match.description };
    },
  },
];

const SYSTEM_PROMPT = `You are Abbie AI, the assistant built into Abbie's Clean Method's admin dashboard (a residential/commercial cleaning business in Spokane Valley, WA). You help the admin quickly check real business numbers, look up leads, change a lead's status, and find pages in the dashboard.

Rules:
- Only state facts that came from a tool call this turn. Never estimate, guess, or recall a number from a previous conversation -- if a tool hasn't given you a number, you don't have it.
- If no tool can answer the question, say so plainly and suggest where in the dashboard they might look (use find_admin_page), rather than guessing.
- To change a lead's status, ALWAYS use propose_lead_status_change -- never claim you've changed something, since only an explicit admin confirmation in the UI actually writes it.
- To open a dashboard page, use find_admin_page and mention the page name; the app handles the actual navigation.
- Keep replies short (1-2 sentences) and direct, like a colleague answering over Slack -- no filler, no "I'd be happy to help".

${HOUSE_WRITING_STYLE}`;

export async function resolveAssistantQuery(rawQuery: string): Promise<AssistantResult> {
  const q = rawQuery.trim();
  if (!q) return { type: "unknown", text: "Ask me something like \"new leads\", \"pipeline value\", or \"mark ACM-26-4F3A9C as contacted\"." };

  const result = await runAgent({ systemPrompt: SYSTEM_PROMPT, tools, userMessage: q });

  const proposeCall = result.toolCalls.find((c) => c.name === "propose_lead_status_change");
  if (proposeCall) {
    const r = proposeCall.result as { ok: boolean; proposedAction?: AssistantAction; summary?: string; error?: string };
    if (r.ok && r.proposedAction) return { type: "confirm", text: result.text || `${r.summary}?`, action: r.proposedAction };
  }

  const navCall = result.toolCalls.find((c) => c.name === "find_admin_page");
  if (navCall) {
    const r = navCall.result as { found: boolean; href?: string; built?: boolean };
    if (r.found && r.href && r.built) return { type: "navigate", text: result.text || "Opening…", href: r.href };
    if (r.found && r.href) return { type: "answer", text: result.text, href: r.href };
  }

  if (result.notConfigured) return { type: "unknown", text: result.text };
  return { type: "answer", text: result.text };
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
    if (!updated) return { ok: false, error: "Couldn't update that lead, it may have been deleted." };
    return { ok: true, text: `${updated.reference} marked ${action.statusLabel}.`, href: "/admin/leads" };
  }
  return { ok: false, error: "Unknown action." };
}
