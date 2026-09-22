import { business, whatsappLink } from "@/lib/data/business";
import { services, type ServiceId } from "@/lib/data/services";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { getServicePriceLabel } from "@/lib/pricing";
import { listServiceAreas } from "@/lib/server/content";
import { getContactInfo, getBusinessHours } from "@/lib/server/siteSettings";

/**
 * Public/guest counterpart to the admin and customer Abbie Assistants -- blueprint section 4's
 * "guest can access public services and create inquiry, never private account data." Every answer
 * here is real business info a visitor could already find on the site (pricing, areas, hours,
 * contact) -- nothing here reads any customer/lead/booking data, by construction (it takes no
 * customer identity at all). No model call, same as the other two.
 */

export interface GuestAssistantResult {
  type: "answer" | "navigate" | "unknown";
  text: string;
  href?: string;
}

interface Tool {
  match: (q: string) => boolean;
  run: () => Promise<GuestAssistantResult>;
}

const tools: Tool[] = [
  {
    match: (q) => /(area|zip|location|where.*(serve|clean)|do you (serve|cover))/.test(q),
    run: async () => {
      const areas = await listServiceAreas(true);
      const names = areas.length > 0 ? areas.map((a) => a.name) : [...business.areaServed];
      return { type: "answer", text: `We serve ${names.join(", ")}. Not sure if you're in range? Enter your ZIP on the estimate form and we'll confirm.` };
    },
  },
  {
    match: (q) => /(hour|open|close|when.*(open|available))/.test(q),
    run: async () => {
      const hours = await getBusinessHours();
      return { type: "answer", text: hours.map((h) => `${h.days}: ${h.time}`).join(" · ") };
    },
  },
  {
    match: (q) => /(phone|call|contact|email|reach you)/.test(q),
    run: async () => {
      const contact = await getContactInfo();
      return { type: "answer", text: `Call or text ${contact.phoneDisplay}, or email ${contact.email}.` };
    },
  },
  {
    match: (q) => /(whatsapp)/.test(q),
    run: async () => {
      const contact = await getContactInfo();
      return { type: "navigate", text: "Opening WhatsApp…", href: whatsappLink("Hi Abbie's Clean Method! I have a question.", contact.whatsappE164) };
    },
  },
  {
    match: (q) => /(price|cost|how much|rate)/.test(q),
    run: async () => {
      const config = await getPricingConfig();
      const highlights: ServiceId[] = ["standard-cleaning", "deep-cleaning", "move-in-cleaning", "move-out-cleaning"];
      const lines = highlights.map((id) => `${services.find((s) => s.id === id)?.name}: ${getServicePriceLabel(id, config)}`);
      return { type: "answer", text: `Starting prices — ${lines.join(" · ")}. Exact pricing depends on your home's size and condition; get a free estimate for a real number.` };
    },
  },
  {
    match: (q) => /(service|offer|what.*(do you do|clean))/.test(q),
    run: async () => ({ type: "answer", text: `We offer ${services.filter((s) => s.id !== "commercial-cleaning").map((s) => s.name).join(", ")}, and commercial cleaning by request.` }),
  },
  {
    match: (q) => /(estimate|quote|book|schedule|sign up|get started)/.test(q),
    run: async () => ({ type: "navigate", text: "Taking you to the free estimate form…", href: "/estimate" }),
  },
  {
    match: (q) => /(pet|dog|cat)/.test(q),
    run: async () => ({ type: "answer", text: "Yes — we're comfortable working around pets, and can note any special instructions when you book." }),
  },
];

const EXAMPLES = ["what areas do you serve", "how much does it cost", "your hours", "get an estimate"];

export async function resolveGuestAssistantQuery(rawQuery: string): Promise<GuestAssistantResult> {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { type: "unknown", text: `Try asking: ${EXAMPLES.join(", ")}.` };
  for (const tool of tools) {
    if (tool.match(q)) return tool.run();
  }
  const contact = await getContactInfo();
  return { type: "unknown", text: `I'm not sure about that one — try asking: ${EXAMPLES.join(", ")}. For anything else, call/text ${contact.phoneDisplay}.` };
}
