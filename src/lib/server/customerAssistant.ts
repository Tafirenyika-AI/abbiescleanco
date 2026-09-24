import { getMyRequests, getMyQuotes, getMyBookings, getMyPayments } from "@/lib/server/customerHistory";

/**
 * Customer-facing counterpart to src/lib/server/assistant.ts (the admin Abbie Assistant) --
 * blueprint section 4's "authenticated customers see only own records." Same shape, same
 * no-model-call approach: every answer is a real, instant lookup scoped to the caller's own
 * customerId (passed in from the verified session, never from client input), never a guess.
 */

export interface CustomerAssistantResult {
  type: "answer" | "unknown";
  text: string;
}

interface Tool {
  match: (q: string) => boolean;
  run: (customerId: string) => Promise<CustomerAssistantResult>;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const tools: Tool[] = [
  {
    match: (q) => /(next appointment|next booking|next visit|when.*(cleaning|clean|visit))/.test(q),
    run: async (customerId) => {
      const bookings = await getMyBookings(customerId);
      const upcoming = bookings
        .filter((b) => b.scheduledStart && !["CANCELLED", "COMPLETED"].includes(b.status) && new Date(b.scheduledStart) > new Date())
        .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime())[0];
      if (!upcoming) return { type: "answer", text: "You don't have an upcoming booking scheduled right now. Head to the Bookings tab, or get a new estimate, to set one up." };
      const label = new Date(upcoming.scheduledStart!).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      return { type: "answer", text: `Your next visit is ${label}, ${upcoming.serviceName} at ${upcoming.address}.` };
    },
  },
  {
    match: (q) => /(owe|balance|how much.*(pay|due)|outstanding)/.test(q),
    run: async (customerId) => {
      const [bookings, payments] = await Promise.all([getMyBookings(customerId), getMyPayments(customerId)]);
      // Balance needs each booking's quote total, which getMyBookings doesn't carry -- approximate
      // honestly from payment status instead: anything not fully reflected as PAID is worth a look.
      const pendingPayments = payments.filter((p) => p.status === "PENDING");
      const active = bookings.filter((b) => !["CANCELLED", "COMPLETED"].includes(b.status));
      if (pendingPayments.length === 0 && active.length === 0) return { type: "answer", text: "Nothing showing as pending right now. Check the Payments tab for full detail on any booking." };
      const pendingTotal = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
      return {
        type: "answer",
        text: pendingTotal > 0
          ? `You have ${money(pendingTotal)} pending across ${pendingPayments.length} payment${pendingPayments.length === 1 ? "" : "s"}. Open a booking's Payment section for the exact balance and to pay online.`
          : "No pending payments on file. Open a specific booking's Payment section for its exact total and balance.",
      };
    },
  },
  {
    match: (q) => /(my bookings?|how many booking)/.test(q),
    run: async (customerId) => {
      const bookings = await getMyBookings(customerId);
      const active = bookings.filter((b) => !["CANCELLED", "COMPLETED"].includes(b.status));
      return { type: "answer", text: `You have ${active.length} active booking${active.length === 1 ? "" : "s"} (${bookings.length} total, including past and cancelled).` };
    },
  },
  {
    match: (q) => /(my quotes?|waiting.*quote|quote.*waiting)/.test(q),
    run: async (customerId) => {
      const quotes = await getMyQuotes(customerId);
      const sent = quotes.filter((q2) => q2.status === "SENT");
      if (sent.length === 0) return { type: "answer", text: "No quotes are waiting on a decision from you right now." };
      return { type: "answer", text: `${sent.length} quote${sent.length === 1 ? " is" : "s are"} waiting on your decision, check the Quotes tab to accept or decline.` };
    },
  },
  {
    match: (q) => /(my request|estimate request)/.test(q),
    run: async (customerId) => {
      const requests = await getMyRequests(customerId);
      const open = requests.filter((r) => !["COMPLETED", "CANCELLED", "LOST"].includes(r.status));
      return { type: "answer", text: `${open.length} request${open.length === 1 ? "" : "s"} still open (${requests.length} total).` };
    },
  },
];

const EXAMPLES = ["next appointment", "what do I owe", "my bookings", "my quotes"];

export async function resolveCustomerAssistantQuery(customerId: string, rawQuery: string): Promise<CustomerAssistantResult> {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { type: "unknown", text: `Try asking: ${EXAMPLES.join(", ")}.` };
  for (const tool of tools) {
    if (tool.match(q)) return tool.run(customerId);
  }
  return { type: "unknown", text: `I don't have an answer for that yet, try: ${EXAMPLES.join(", ")}. For anything else, send us a note from a booking or request.` };
}
