/** Client-safe document-vault types/constants — no server-only imports (Prisma, fs). */

export const DOCUMENT_CATEGORIES = ["AGREEMENT", "INSURANCE", "LICENSE", "RECEIPT", "STATEMENT", "TAX", "LEGAL", "CORRESPONDENCE", "OTHER"] as const;
export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORIES)[number];

export const documentCategoryLabels: Record<DocumentCategoryValue, string> = {
  AGREEMENT: "Agreement / contract",
  INSURANCE: "Insurance",
  LICENSE: "License / permit",
  RECEIPT: "Receipt",
  STATEMENT: "Statement",
  TAX: "Tax document",
  LEGAL: "Legal",
  CORRESPONDENCE: "Correspondence",
  OTHER: "Other",
};

export const DOCUMENT_STATUSES = ["ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"] as const;
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number];

export const documentStatusLabels: Record<DocumentStatusValue, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  ARCHIVED: "Archived",
};

export interface DocumentFileRow {
  id: string;
  fileId: string;
  filename: string;
  contentType: string;
  uploadedAt: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  category: DocumentCategoryValue;
  status: DocumentStatusValue;
  reference: string | null;
  counterpartyName: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  notes: string | null;
  correspondenceLog: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  files: DocumentFileRow[];
}

/** Real, checkable fact only -- an ACTIVE document whose expirationDate has already passed,
 *  never a guess about renewal status. */
export function isPastExpiration(doc: { status: DocumentStatusValue; expirationDate: string | null }): boolean {
  if (doc.status !== "ACTIVE" || !doc.expirationDate) return false;
  return new Date(doc.expirationDate).getTime() < Date.now();
}
