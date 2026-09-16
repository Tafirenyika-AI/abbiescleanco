import type { QuoteRequestInput } from "@/lib/validation/quote";
import type { EstimateResult } from "@/lib/pricing";

/** Client-safe lead types/constants — no server-only imports (fs, Prisma). */

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "ESTIMATE_SENT",
  "AWAITING_CUSTOMER",
  "CONFIRMED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "LOST",
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const leadStatusLabels: Record<LeadStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  ESTIMATE_SENT: "Quote sent",
  AWAITING_CUSTOMER: "Awaiting customer",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  LOST: "Lost",
};

export interface StoredLead {
  id: string;
  reference: string;
  status: LeadStatusValue;
  lostReason?: string | null;
  source: string;
  campaign?: string;
  input: QuoteRequestInput;
  estimate: EstimateResult;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityEntry {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  adminName: string | null;
  createdAt: string;
}
