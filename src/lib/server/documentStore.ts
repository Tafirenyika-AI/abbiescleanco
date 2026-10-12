import { prisma, isDatabaseConfigured } from "@/lib/db";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, type DocumentCategoryValue, type DocumentStatusValue, type DocumentRow, type DocumentFileRow } from "@/lib/documents";

export {
  DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, documentCategoryLabels, documentStatusLabels,
  type DocumentCategoryValue, type DocumentStatusValue, type DocumentRow, type DocumentFileRow,
} from "@/lib/documents";

/**
 * General business document vault: agreements/contracts, insurance, licenses, receipts,
 * statements, legal paperwork, and manually-logged correspondence. See the schema comment on
 * BusinessDocument for why email correspondence is a manual log, not a live mailbox sync.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  return prisma;
}

const DOCUMENT_INCLUDE = { createdBy: { select: { name: true } }, files: { orderBy: { uploadedAt: "asc" as const } } };

function mapRow(d: {
  id: string; title: string; category: string; status: string; reference: string | null;
  counterpartyName: string | null; effectiveDate: Date | null; expirationDate: Date | null;
  notes: string | null; correspondenceLog: string | null; createdAt: Date; updatedAt: Date;
  createdBy?: { name: string } | null;
  files: { id: string; fileId: string; filename: string; contentType: string; uploadedAt: Date }[];
}): DocumentRow {
  return {
    id: d.id,
    title: d.title,
    category: (DOCUMENT_CATEGORIES as readonly string[]).includes(d.category) ? (d.category as DocumentCategoryValue) : "OTHER",
    status: (DOCUMENT_STATUSES as readonly string[]).includes(d.status) ? (d.status as DocumentStatusValue) : "ACTIVE",
    reference: d.reference,
    counterpartyName: d.counterpartyName,
    effectiveDate: d.effectiveDate?.toISOString() ?? null,
    expirationDate: d.expirationDate?.toISOString() ?? null,
    notes: d.notes,
    correspondenceLog: d.correspondenceLog,
    createdByName: d.createdBy?.name ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    files: d.files.map((f) => ({ id: f.id, fileId: f.fileId, filename: f.filename, contentType: f.contentType, uploadedAt: f.uploadedAt.toISOString() })),
  };
}

const CATEGORY_CODE: Record<DocumentCategoryValue, string> = {
  AGREEMENT: "AGR",
  INSURANCE: "INS",
  LICENSE: "LIC",
  RECEIPT: "REC",
  STATEMENT: "STA",
  TAX: "TAX",
  LEGAL: "LEG",
  CORRESPONDENCE: "COR",
  OTHER: "DOC",
};

/**
 * "ACM-<category code>-<year>-<seq>", mirroring the real reference format the business already
 * uses (e.g. ACM-SDI-2026-001) -- the code here is the document's category since there's no
 * reliable way to derive a counterparty abbreviation automatically. Always editable afterward;
 * this is only ever a starting suggestion when the admin leaves the field blank.
 */
export async function generateDocumentReference(category: DocumentCategoryValue): Promise<string> {
  const year = new Date().getFullYear();
  const code = CATEGORY_CODE[category];
  const prefix = `ACM-${code}-${year}-`;
  if (!isDatabaseConfigured || !prisma) return `${prefix}001`;
  const count = await prisma.businessDocument.count({ where: { reference: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export interface ListDocumentsFilters {
  category?: DocumentCategoryValue;
  status?: DocumentStatusValue;
  search?: string;
}

export async function listDocuments(filters: ListDocumentsFilters = {}): Promise<DocumentRow[]> {
  const rows = await db().businessDocument.findMany({
    where: {
      deletedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { reference: { contains: filters.search, mode: "insensitive" } },
              { counterpartyName: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: DOCUMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map(mapRow);
}

export async function getDocumentById(id: string): Promise<DocumentRow | null> {
  const row = await db().businessDocument.findFirst({ where: { id, deletedAt: null }, include: DOCUMENT_INCLUDE });
  return row ? mapRow(row) : null;
}

export interface CreateDocumentInput {
  title: string;
  category: DocumentCategoryValue;
  status?: DocumentStatusValue;
  reference?: string | null; // null/omitted -> auto-generate; "" is treated as "no reference"
  counterpartyName?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  notes?: string | null;
  correspondenceLog?: string | null;
  createdById?: string | null;
}

export async function createDocument(input: CreateDocumentInput): Promise<{ ok: true; document: DocumentRow } | { ok: false; error: string }> {
  const reference = input.reference === undefined || input.reference === null ? await generateDocumentReference(input.category) : input.reference || null;
  if (reference) {
    const existing = await db().businessDocument.findFirst({ where: { reference, deletedAt: null } });
    if (existing) return { ok: false, error: `Reference "${reference}" is already used by another document.` };
  }
  const row = await db().businessDocument.create({
    data: {
      title: input.title,
      category: input.category,
      status: input.status ?? "ACTIVE",
      reference,
      counterpartyName: input.counterpartyName || null,
      effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
      notes: input.notes || null,
      correspondenceLog: input.correspondenceLog || null,
      createdById: input.createdById || null,
    },
    include: DOCUMENT_INCLUDE,
  });
  return { ok: true, document: mapRow(row) };
}

export interface UpdateDocumentInput {
  title?: string;
  category?: DocumentCategoryValue;
  status?: DocumentStatusValue;
  reference?: string | null; // "" or null clears it; a non-empty string sets/renames it
  counterpartyName?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  notes?: string | null;
  correspondenceLog?: string | null;
}

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<{ ok: true; document: DocumentRow } | { ok: false; error: string }> {
  const existing = await db().businessDocument.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: "Not found" };

  if (input.reference !== undefined) {
    const nextRef = input.reference || null;
    if (nextRef && nextRef !== existing.reference) {
      const dupe = await db().businessDocument.findFirst({ where: { reference: nextRef, deletedAt: null, id: { not: id } } });
      if (dupe) return { ok: false, error: `Reference "${nextRef}" is already used by another document.` };
    }
  }

  const row = await db().businessDocument.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.reference !== undefined ? { reference: input.reference || null } : {}),
      ...(input.counterpartyName !== undefined ? { counterpartyName: input.counterpartyName || null } : {}),
      ...(input.effectiveDate !== undefined ? { effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null } : {}),
      ...(input.expirationDate !== undefined ? { expirationDate: input.expirationDate ? new Date(input.expirationDate) : null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(input.correspondenceLog !== undefined ? { correspondenceLog: input.correspondenceLog || null } : {}),
    },
    include: DOCUMENT_INCLUDE,
  });
  return { ok: true, document: mapRow(row) };
}

/** Soft delete, same convention as Booking/Review -- keeps the audit trail (who created it, when)
 *  without it cluttering the active list. */
export async function deleteDocument(id: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().businessDocument.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: "Not found" };
  await db().businessDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}

export async function addDocumentFile(documentId: string, file: { fileId: string; filename: string; contentType: string }): Promise<{ ok: true; file: DocumentFileRow } | { ok: false; error: string }> {
  const doc = await db().businessDocument.findFirst({ where: { id: documentId, deletedAt: null } });
  if (!doc) return { ok: false, error: "Document not found" };
  const row = await db().businessDocumentFile.create({ data: { documentId, fileId: file.fileId, filename: file.filename, contentType: file.contentType } });
  return { ok: true, file: { id: row.id, fileId: row.fileId, filename: row.filename, contentType: row.contentType, uploadedAt: row.uploadedAt.toISOString() } };
}

export async function deleteDocumentFile(fileRowId: string): Promise<{ ok: boolean }> {
  await db().businessDocumentFile.delete({ where: { id: fileRowId } }).catch(() => null);
  return { ok: true };
}

/** Looks up which document (if any) owns a given StoredFile id, and whether it's still live --
 *  used by the authenticated file-serving route to confirm access before streaming content. */
export async function findDocumentFileByFileId(fileId: string): Promise<{ storedFileId: string; contentType: string; filename: string } | null> {
  const row = await db().businessDocumentFile.findUnique({ where: { fileId }, include: { document: true } });
  if (!row || row.document.deletedAt) return null;
  return { storedFileId: row.fileId, contentType: row.contentType, filename: row.filename };
}
