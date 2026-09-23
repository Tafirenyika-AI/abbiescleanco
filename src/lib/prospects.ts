/** Client-safe prospecting types/constants — no server-only imports (Prisma, fs). */

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
  discoveredAt: string;
  contactedAt: string | null;
}
