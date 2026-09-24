import { business, whatsappLink } from "@/lib/data/business";
import { services, type ServiceId } from "@/lib/data/services";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { getServicePriceLabel } from "@/lib/pricing";
import { listServiceAreas } from "@/lib/server/content";
import { getContactInfo, getBusinessHours } from "@/lib/server/siteSettings";
import { runAgent, type AgentTool } from "@/lib/server/aiAgent";

/**
 * Public/guest counterpart to the admin and customer Abbie AI assistants -- a real, model-backed
 * assistant for site visitors. Structurally scoped to public info only: every tool below reads real
 * business info a visitor could already find on the site (pricing, areas, hours, contact) -- there
 * is no tool here that reads any customer/lead/booking data, and this function takes no customer
 * identity at all, so there's no way for the model to answer a private question even if asked.
 */

export interface GuestAssistantResult {
  type: "answer" | "navigate" | "unknown";
  text: string;
  href?: string;
}

const tools: AgentTool[] = [
  {
    name: "get_service_areas",
    description: "The real list of cities/areas the business serves.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const areas = await listServiceAreas(true);
      const names = areas.length > 0 ? areas.map((a) => a.name) : [...business.areaServed];
      return { areas: names };
    },
  },
  {
    name: "get_hours",
    description: "The business's real operating hours.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const hours = await getBusinessHours();
      return { hours: hours.map((h) => `${h.days}: ${h.time}`) };
    },
  },
  {
    name: "get_contact_info",
    description: "Real phone number and email to reach the business.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const contact = await getContactInfo();
      return { phone: contact.phoneDisplay, email: contact.email };
    },
  },
  {
    name: "open_whatsapp",
    description: "Use when the visitor wants to message on WhatsApp. Returns a link the app will open.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const contact = await getContactInfo();
      return { href: whatsappLink("Hi Abbie's Clean Method! I have a question.", contact.whatsappE164) };
    },
  },
  {
    name: "get_pricing",
    description: "Real starting prices for the main cleaning services.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const config = await getPricingConfig();
      const highlights: ServiceId[] = ["standard-cleaning", "deep-cleaning", "move-in-cleaning", "move-out-cleaning"];
      const lines = highlights.map((id) => `${services.find((s) => s.id === id)?.name}: ${getServicePriceLabel(id, config)}`);
      return { startingPrices: lines };
    },
  },
  {
    name: "get_services_list",
    description: "The real list of services the business offers.",
    input_schema: { type: "object", properties: {} },
    run: async () => ({ services: services.filter((s) => s.id !== "commercial-cleaning").map((s) => s.name), note: "Commercial cleaning available by request." }),
  },
  {
    name: "go_to_estimate",
    description: "Use when the visitor wants to get a quote, book, or start an estimate. Returns the page to navigate to.",
    input_schema: { type: "object", properties: {} },
    run: async () => ({ href: "/estimate" }),
  },
];

const SYSTEM_PROMPT = `You are Abbie AI, the assistant on Abbie's Clean Method's public website (a residential/commercial cleaning business in Spokane Valley, WA). You help visitors with real, public questions about service areas, pricing, hours, contact info, and getting a free estimate.

Rules:
- Only state facts that came from a tool call this turn -- never guess a price, area, or hours.
- You have NO access to any customer, lead, or booking data, and can't look any up -- if asked something like that, say you can't help with that here.
- You're comfortable confirming the business works around pets and can note special instructions at booking, since that's a real, standing policy -- no tool needed for that one.
- If nothing here answers the question, say so honestly and point to calling/texting the business (use get_contact_info) rather than guessing.
- Keep replies short (1-2 sentences), friendly, and direct.`;

export async function resolveGuestAssistantQuery(rawQuery: string): Promise<GuestAssistantResult> {
  const q = rawQuery.trim();
  if (!q) return { type: "unknown", text: "Try asking what areas we serve, how much it costs, our hours, or say \"get an estimate\"." };

  const result = await runAgent({ systemPrompt: SYSTEM_PROMPT, tools, userMessage: q });
  if (result.notConfigured) {
    const contact = await getContactInfo();
    return { type: "unknown", text: `${result.text} In the meantime, call or text ${contact.phoneDisplay}.` };
  }

  const navCall = result.toolCalls.find((c) => c.name === "go_to_estimate" || c.name === "open_whatsapp");
  if (navCall) {
    const r = navCall.result as { href?: string };
    if (r.href) return { type: "navigate", text: result.text || "Taking you there…", href: r.href };
  }

  return { type: "answer", text: result.text };
}
