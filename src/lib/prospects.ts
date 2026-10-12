/** Client-safe prospecting types/constants — no server-only imports (Prisma, fs). */

import { business } from "@/lib/data/business";

export const PROSPECT_CATEGORIES = ["PROPERTY_MANAGER", "REALTOR", "LOCAL_BUSINESS", "HOMEOWNER", "OTHER"] as const;
export type ProspectCategory = (typeof PROSPECT_CATEGORIES)[number];

export const prospectCategoryLabels: Record<ProspectCategory, string> = {
  PROPERTY_MANAGER: "Property manager / landlord",
  REALTOR: "Realtor",
  LOCAL_BUSINESS: "Local business",
  HOMEOWNER: "Homeowner",
  OTHER: "Other",
};

export const PROSPECT_STATUSES = ["NEW", "DRAFTED", "APPROVED", "SENT", "REPLIED", "CONVERTED", "REJECTED", "DO_NOT_CONTACT"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const prospectStatusLabels: Record<ProspectStatus, string> = {
  NEW: "New",
  DRAFTED: "Drafted",
  APPROVED: "Queued to send",
  SENT: "Sent",
  REPLIED: "Replied",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
  DO_NOT_CONTACT: "Do not contact",
};

export interface ProspectRow {
  id: string;
  category: ProspectCategory;
  businessName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  source: string;
  sourceQuery: string | null;
  status: ProspectStatus;
  draftSubject: string | null;
  draftBody: string | null;
  draftSmsBody: string | null;
  notes: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  researchNotes: string | null;
  researchSources: { url: string; title: string }[] | null;
  researchedAt: string | null;
  convertedLeadId: string | null;
  convertedLeadReference: string | null;
  discoveredAt: string;
  contactedAt: string | null;
}

/**
 * What kind of cleaning this business likely needs, based only on its real, known category --
 * a deterministic hint to help triage, never a claim about what they've actually asked for.
 */
export const likelyServiceHints: Record<ProspectCategory, string> = {
  PROPERTY_MANAGER: "Turnover cleaning between tenants, often recurring, multi-unit.",
  REALTOR: "Move-in / move-out cleaning ahead of showings or closings.",
  LOCAL_BUSINESS: "Recurring commercial cleaning on a set schedule.",
  HOMEOWNER: "Residential cleaning, one-time or recurring.",
  OTHER: "General residential or commercial cleaning.",
};

export interface FitScore {
  level: "LOW" | "MEDIUM" | "HIGH";
  /** Real, checkable facts that drove the level -- always shown alongside it, never a bare label. */
  factors: string[];
}

/**
 * A transparent priority signal, not a prediction -- we have no real conversion history to
 * calibrate an actual probability against yet, so this only ever reflects facts we can point to
 * (has a website, has a phone number, category, whether the address falls in the real declared
 * service area), never a fabricated percentage.
 */
export function computeFitScore(p: { category: ProspectCategory; website: string | null; phone: string | null; address: string | null }): FitScore {
  const factors: string[] = [];
  let points = 0;

  if (p.website) {
    points += 1;
    factors.push("Has a real website");
  }
  if (p.phone) {
    points += 1;
    factors.push("Has a phone number on file");
  }
  if (p.category === "PROPERTY_MANAGER" || p.category === "REALTOR") {
    points += 1;
    factors.push("Business type often needs recurring cleaning");
  }
  if (p.address) {
    const inServiceArea = business.areaServed.some((city) => p.address!.toLowerCase().includes(city.toLowerCase()));
    if (inServiceArea) {
      points += 1;
      factors.push("Address is within the declared service area");
    } else {
      factors.push("Address may be outside the declared service area");
    }
  }

  const level: FitScore["level"] = points >= 3 ? "HIGH" : points >= 2 ? "MEDIUM" : "LOW";
  return { level, factors };
}

/**
 * Customer-acquisition brief's commercial lead-scoring rubric (section 11), as a real weighted
 * calculation an admin can adjust -- not a fixed black box. Defaults sum to 100 (the brief's own
 * 30/25/20/15/10 split); any combination that sums to 100 is accepted.
 */
export interface CommercialOpportunityWeights {
  buyingSignal: number;
  recurringPotential: number;
  decisionMakerAccess: number;
  commercialSuitability: number;
  geographicFit: number;
}

export const DEFAULT_COMMERCIAL_OPPORTUNITY_WEIGHTS: CommercialOpportunityWeights = {
  buyingSignal: 30,
  recurringPotential: 25,
  decisionMakerAccess: 20,
  commercialSuitability: 15,
  geographicFit: 10,
};

export interface CommercialOpportunityScore {
  score: number; // 0-100
  breakdown: { factor: string; weight: number; points: number; reason: string }[];
}

/**
 * Every factor is a real, checkable fact already on file for this prospect (category, contact
 * info present, address, and whether it was found via a genuine buying-signal source like the
 * web-intent search) -- never a guessed probability. `researchedAt`/`researchNotes` being present
 * reflects a real web search this app already ran (see researchProspect), not an assumption.
 */
export function computeCommercialOpportunityScore(
  p: { category: ProspectCategory; website: string | null; phone: string | null; contactName: string | null; address: string | null; source: string; researchNotes: string | null },
  weights: CommercialOpportunityWeights = DEFAULT_COMMERCIAL_OPPORTUNITY_WEIGHTS
): CommercialOpportunityScore {
  let buyingSignal: { fraction: number; reason: string };
  if (p.source === "web_intent_search") {
    buyingSignal = { fraction: 1, reason: "Found via a genuine public post actively looking for a cleaner" };
  } else if (p.researchNotes) {
    buyingSignal = { fraction: 0.5, reason: "Has real research notes on file that may indicate a buying signal" };
  } else {
    buyingSignal = { fraction: 0, reason: "No buying-signal evidence on file yet" };
  }

  let recurringPotential: { fraction: number; reason: string };
  if (p.category === "PROPERTY_MANAGER" || p.category === "LOCAL_BUSINESS") {
    recurringPotential = { fraction: 1, reason: "Business type typically needs ongoing recurring cleaning" };
  } else if (p.category === "REALTOR") {
    recurringPotential = { fraction: 0.5, reason: "Often one-time move-in/move-out work, less recurring" };
  } else {
    recurringPotential = { fraction: 0.3, reason: "Residential/other, recurring potential less certain" };
  }

  let decisionMakerAccess: { fraction: number; reason: string };
  if (p.phone && p.contactName) {
    decisionMakerAccess = { fraction: 1, reason: "Has a named contact and a phone number" };
  } else if (p.phone || p.contactName) {
    decisionMakerAccess = { fraction: 0.6, reason: "Has partial contact access (phone or a name, not both)" };
  } else {
    decisionMakerAccess = { fraction: 0.2, reason: "No named contact or phone on file yet" };
  }

  const commercialSuitability =
    p.category === "PROPERTY_MANAGER" || p.category === "LOCAL_BUSINESS" || p.category === "REALTOR"
      ? { fraction: 1, reason: "Business type is a commercial cleaning fit" }
      : p.category === "HOMEOWNER"
        ? { fraction: 0, reason: "Residential, not a commercial prospect" }
        : { fraction: 0.5, reason: "Category unclear, treated as a partial commercial fit" };

  let geographicFit: { fraction: number; reason: string };
  if (p.address) {
    const inServiceArea = business.areaServed.some((city) => p.address!.toLowerCase().includes(city.toLowerCase()));
    geographicFit = inServiceArea
      ? { fraction: 1, reason: "Address is within the declared service area" }
      : { fraction: 0, reason: "Address may be outside the declared service area" };
  } else {
    geographicFit = { fraction: 0.5, reason: "No address on file yet to check" };
  }

  const factors: { key: keyof CommercialOpportunityWeights; label: string; result: { fraction: number; reason: string } }[] = [
    { key: "buyingSignal", label: "Buying signal", result: buyingSignal },
    { key: "recurringPotential", label: "Recurring cleaning potential", result: recurringPotential },
    { key: "decisionMakerAccess", label: "Decision-maker accessibility", result: decisionMakerAccess },
    { key: "commercialSuitability", label: "Commercial suitability", result: commercialSuitability },
    { key: "geographicFit", label: "Geographic fit", result: geographicFit },
  ];

  const breakdown = factors.map((f) => ({
    factor: f.label,
    weight: weights[f.key],
    points: Math.round(weights[f.key] * f.result.fraction),
    reason: f.result.reason,
  }));
  const score = breakdown.reduce((sum, b) => sum + b.points, 0);

  return { score, breakdown };
}
