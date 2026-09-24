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
  APPROVED: "Approved",
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
