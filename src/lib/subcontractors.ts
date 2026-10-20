/** Client-safe subcontractor types/constants — no server-only imports (Prisma, fs). */

export const SUBCONTRACTOR_PAY_TYPES = ["PER_JOB", "HOURLY", "PERCENTAGE", "FLAT_MONTHLY"] as const;
export type SubcontractorPayType = (typeof SUBCONTRACTOR_PAY_TYPES)[number];

export const subcontractorPayTypeLabels: Record<SubcontractorPayType, string> = {
  PER_JOB: "Flat rate per job",
  HOURLY: "Hourly",
  PERCENTAGE: "Percentage of job total",
  FLAT_MONTHLY: "Flat monthly amount",
};

export const SUBCONTRACTOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type SubcontractorStatusValue = (typeof SUBCONTRACTOR_STATUSES)[number];

export interface SubcontractorRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  payType: SubcontractorPayType;
  payRateCents: number;
  payRatePercent: number | null;
  taxIdLast4: string | null;
  status: SubcontractorStatusValue;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayablesJob {
  bookingId: string;
  reference: string;
  completedDate: string | null;
  earnedCents: number | null;
  reason: string | null;
}

export interface SubcontractorPayables {
  payType: SubcontractorPayType;
  completedJobsCount: number;
  earnedCents: number;
  uncomputableJobsCount: number;
  paidCents: number;
  owedCents: number;
  jobs: PayablesJob[];
  autoCalculated: boolean;
}
