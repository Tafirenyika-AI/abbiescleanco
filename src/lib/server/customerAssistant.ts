import { getMyRequests, getMyQuotes, getMyBookings, getMyPayments } from "@/lib/server/customerHistory";
import { runAgent, type AgentTool } from "@/lib/server/aiAgent";

/**
 * Customer-facing counterpart to src/lib/server/assistant.ts -- a real, model-backed assistant
 * scoped to the caller's own account. The customerId comes from the verified session (see the API
 * route), never from the model or client input, and every tool below only ever reads that one
 * customer's own records -- there is no tool here that could look up anyone else's data, so there's
 * no path for the model to leak it even if asked.
 */

export interface CustomerAssistantResult {
  type: "answer" | "unknown";
  text: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function toolsFor(customerId: string): AgentTool[] {
  return [
    {
      name: "get_next_appointment",
      description: "The customer's next upcoming (not cancelled/completed) booking.",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        const bookings = await getMyBookings(customerId);
        const upcoming = bookings
          .filter((b) => b.scheduledStart && !["CANCELLED", "COMPLETED"].includes(b.status) && new Date(b.scheduledStart) > new Date())
          .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime())[0];
        if (!upcoming) return { hasUpcoming: false };
        const label = new Date(upcoming.scheduledStart!).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
        return { hasUpcoming: true, when: label, service: upcoming.serviceName, address: upcoming.address };
      },
    },
    {
      name: "get_balance",
      description: "Any pending/outstanding payments on the customer's account.",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        const [bookings, payments] = await Promise.all([getMyBookings(customerId), getMyPayments(customerId)]);
        const pendingPayments = payments.filter((p) => p.status === "PENDING");
        const active = bookings.filter((b) => !["CANCELLED", "COMPLETED"].includes(b.status));
        const pendingTotal = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
        return { hasActiveBookings: active.length > 0, pendingCount: pendingPayments.length, pendingTotal: pendingTotal > 0 ? money(pendingTotal) : null };
      },
    },
    {
      name: "get_my_bookings",
      description: "How many active and total bookings the customer has.",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        const bookings = await getMyBookings(customerId);
        const active = bookings.filter((b) => !["CANCELLED", "COMPLETED"].includes(b.status));
        return { active: active.length, total: bookings.length };
      },
    },
    {
      name: "get_my_quotes",
      description: "Quotes sent to the customer that are still awaiting their decision (accept/decline).",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        const quotes = await getMyQuotes(customerId);
        return { awaitingDecision: quotes.filter((q) => q.status === "SENT").length };
      },
    },
    {
      name: "get_my_requests",
      description: "The customer's estimate requests that are still open (not completed/cancelled/lost).",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        const requests = await getMyRequests(customerId);
        return { open: requests.filter((r) => !["COMPLETED", "CANCELLED", "LOST"].includes(r.status)).length, total: requests.length };
      },
    },
  ];
}

const SYSTEM_PROMPT = `You are Abbie AI, the assistant on Abbie's Clean Method's customer portal (a residential/commercial cleaning business in Spokane Valley, WA). You help this one logged-in customer check their own appointments, balance, bookings, quotes, and requests.

Rules:
- Only state facts that came from a tool call this turn -- never guess or recall a number from earlier in the conversation.
- You can only see THIS customer's own data. If asked about anything else, say you can't help with that here.
- If no tool answers the question, say so honestly and suggest they send a note from a booking or request for anything more specific.
- Keep replies short (1-2 sentences) and warm but direct.`;

export async function resolveCustomerAssistantQuery(customerId: string, rawQuery: string): Promise<CustomerAssistantResult> {
  const q = rawQuery.trim();
  if (!q) return { type: "unknown", text: "Try asking about your next appointment, balance, bookings, or quotes." };

  const result = await runAgent({ systemPrompt: SYSTEM_PROMPT, tools: toolsFor(customerId), userMessage: q });
  if (result.notConfigured) return { type: "unknown", text: result.text };
  return { type: "answer", text: result.text };
}
