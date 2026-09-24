import crypto from "node:crypto";
import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Bank CSV import + reconciliation (Finance module). CSV upload only for now -- avoids needing a
 * paid banking API (Plaid etc.) to ship something real; a BankProvider abstraction can be added
 * later without rebuilding this, same reasoning as payments' provider field.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Banking requires DATABASE_URL to be configured.");
  return prisma;
}

// ---------- CSV parsing ----------

/** RFC4180-ish CSV line splitter: handles quoted fields with embedded commas/escaped quotes. No
 *  library needed for this -- bank export CSVs are simple, and this keeps banking self-contained
 *  like the rest of this app's hand-rolled CSV export. */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const DATE_KEYS = ["date", "transaction date", "posted date", "posting date", "trans date"];
const DESC_KEYS = ["description", "memo", "name", "payee", "details", "narrative"];
const AMOUNT_KEYS = ["amount"];
const DEBIT_KEYS = ["debit", "withdrawal", "withdrawals", "money out", "out"];
const CREDIT_KEYS = ["credit", "deposit", "deposits", "money in", "in"];

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1"); // "(12.34)" -> "-12.34"
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;
  // MM/DD/YYYY, the most common US bank export format
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(`${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export interface ParsedBankRow {
  date: Date;
  description: string;
  amount: number; // cents, signed
  raw: Record<string, string>;
}

export interface ParseCsvResult {
  ok: boolean;
  error?: string;
  rows?: ParsedBankRow[];
  unparseableCount?: number;
}

/** Tolerant of common column-name variants across banks; supports either a single signed Amount
 *  column or separate Debit/Credit columns. Never guesses at a row it can't confidently parse --
 *  skips it and reports how many were skipped, rather than silently inventing a date or amount. */
export function parseBankCsv(text: string): ParseCsvResult {
  const lines = parseCsvLines(text);
  if (lines.length < 2) return { ok: false, error: "The file doesn't look like a CSV with a header row and at least one transaction." };

  const headers = lines[0];
  const dateCol = findColumn(headers, DATE_KEYS);
  const descCol = findColumn(headers, DESC_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);
  const debitCol = findColumn(headers, DEBIT_KEYS);
  const creditCol = findColumn(headers, CREDIT_KEYS);

  if (dateCol === -1) return { ok: false, error: "Couldn't find a date column. Expected a header like \"Date\" or \"Transaction Date\"." };
  if (descCol === -1) return { ok: false, error: "Couldn't find a description column. Expected a header like \"Description\" or \"Memo\"." };
  if (amountCol === -1 && (debitCol === -1 || creditCol === -1)) {
    return { ok: false, error: "Couldn't find an Amount column, or both Debit and Credit columns." };
  }

  const rows: ParsedBankRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const date = parseDate(line[dateCol] ?? "");
    const description = (line[descCol] ?? "").trim();
    let amount: number | null = null;
    if (amountCol !== -1) {
      amount = parseAmount(line[amountCol] ?? "");
    } else {
      const debit = parseAmount(line[debitCol] ?? "") ?? 0;
      const credit = parseAmount(line[creditCol] ?? "") ?? 0;
      amount = credit - Math.abs(debit);
    }
    if (!date || !description || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { raw[h || `col${i}`] = line[i] ?? ""; });
    rows.push({ date, description, amount, raw });
  }

  if (rows.length === 0) return { ok: false, error: `Found ${lines.length - 1} rows but couldn't parse any of them -- check the file's column headers.` };
  return { ok: true, rows, unparseableCount: skipped };
}

function computeDedupeHash(date: Date, amount: number, description: string): string {
  return crypto.createHash("sha256").update(`${date.toISOString().slice(0, 10)}|${amount}|${description.trim().toLowerCase()}`).digest("hex");
}

export interface ImportBankCsvResult {
  ok: boolean;
  error?: string;
  importId?: string;
  rowCount?: number;
  importedCount?: number;
  skippedCount?: number;
}

/** Imports parsed rows, skipping any whose (date, amount, description) exactly matches a
 *  transaction already imported (the real-world case: someone re-uploads the same statement) --
 *  never silently duplicates financial data, and never silently drops a genuinely different
 *  same-day/same-amount charge (those have a different description or don't match at all). */
export async function importBankCsv(filename: string, rows: ParsedBankRow[], adminUserId: string): Promise<ImportBankCsvResult> {
  if (rows.length === 0) return { ok: false, error: "No transactions to import." };
  if (rows.length > 5000) return { ok: false, error: "That's a lot of rows for one file -- please split it into smaller date ranges." };

  const hashes = rows.map((r) => computeDedupeHash(r.date, r.amount, r.description));
  const existing = await db().bankTransaction.findMany({ where: { dedupeHash: { in: hashes } }, select: { dedupeHash: true } });
  const existingSet = new Set(existing.map((e) => e.dedupeHash));

  const toInsert = rows
    .map((r, i) => ({ row: r, hash: hashes[i] }))
    .filter(({ hash }) => !existingSet.has(hash));

  const bankImport = await db().bankImport.create({
    data: {
      filename,
      rowCount: rows.length,
      importedCount: toInsert.length,
      skippedCount: rows.length - toInsert.length,
      uploadedById: adminUserId,
    },
  });

  if (toInsert.length > 0) {
    await db().bankTransaction.createMany({
      data: toInsert.map(({ row, hash }) => ({
        importId: bankImport.id,
        date: row.date,
        description: row.description,
        amount: row.amount,
        rawRow: row.raw,
        dedupeHash: hash,
      })),
    });
  }

  return { ok: true, importId: bankImport.id, rowCount: rows.length, importedCount: toInsert.length, skippedCount: rows.length - toInsert.length };
}

// ---------- Listing + suggested matches ----------

export interface BankTransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "UNMATCHED" | "MATCHED" | "IGNORED";
  matchType: "PAYMENT" | "EXPENSE" | null;
  matchedLabel: string | null;
  matchedAt: string | null;
  matchedByName: string | null;
  suggestion: { type: "PAYMENT" | "EXPENSE"; id: string; label: string } | null;
}

const MATCH_WINDOW_DAYS = 4;

async function findSuggestion(date: Date, amount: number): Promise<{ type: "PAYMENT" | "EXPENSE"; id: string; label: string } | null> {
  const windowStart = new Date(date);
  windowStart.setDate(windowStart.getDate() - MATCH_WINDOW_DAYS);
  const windowEnd = new Date(date);
  windowEnd.setDate(windowEnd.getDate() + MATCH_WINDOW_DAYS);

  if (amount > 0) {
    // Money in -- look for a real PAID payment of the same amount, not already matched.
    const payment = await db().payment.findFirst({
      where: { status: "PAID", amount, createdAt: { gte: windowStart, lte: windowEnd }, bankTransactions: { none: {} } },
      include: { customer: true },
    });
    if (!payment) return null;
    return { type: "PAYMENT", id: payment.id, label: `${payment.customer ? `${payment.customer.firstName} ${payment.customer.lastName}`.trim() : "Payment"} -- $${(payment.amount / 100).toFixed(2)}` };
  }

  const expense = await db().expense.findFirst({
    where: { amount: Math.abs(amount), date: { gte: windowStart, lte: windowEnd }, deletedAt: null, bankTransactions: { none: {} } },
  });
  if (!expense) return null;
  return { type: "EXPENSE", id: expense.id, label: `${expense.vendor || "Expense"} -- $${(expense.amount / 100).toFixed(2)}` };
}

export async function listBankTransactions(filter: "all" | "unmatched" | "matched" | "ignored" = "all"): Promise<BankTransactionRow[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const where = filter === "all" ? {} : { status: filter.toUpperCase() as "UNMATCHED" | "MATCHED" | "IGNORED" };
  const rows = await prisma.bankTransaction.findMany({
    where,
    include: {
      matchedPayment: { include: { customer: true } },
      matchedExpense: true,
      matchedBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  const out: BankTransactionRow[] = [];
  for (const r of rows) {
    let matchedLabel: string | null = null;
    let matchType: "PAYMENT" | "EXPENSE" | null = null;
    if (r.matchedPayment) {
      matchType = "PAYMENT";
      matchedLabel = `${r.matchedPayment.customer ? `${r.matchedPayment.customer.firstName} ${r.matchedPayment.customer.lastName}`.trim() : "Payment"} -- $${(r.matchedPayment.amount / 100).toFixed(2)}`;
    } else if (r.matchedExpense) {
      matchType = "EXPENSE";
      matchedLabel = `${r.matchedExpense.vendor || "Expense"} -- $${(r.matchedExpense.amount / 100).toFixed(2)}`;
    }
    const suggestion = r.status === "UNMATCHED" ? await findSuggestion(r.date, r.amount) : null;
    out.push({
      id: r.id,
      date: r.date.toISOString(),
      description: r.description,
      amount: r.amount,
      status: r.status,
      matchType,
      matchedLabel,
      matchedAt: r.matchedAt?.toISOString() ?? null,
      matchedByName: r.matchedBy?.name ?? null,
      suggestion,
    });
  }
  return out;
}

export async function listRecentUnmatchedRecords(kind: "PAYMENT" | "EXPENSE"): Promise<{ id: string; label: string }[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  if (kind === "PAYMENT") {
    const payments = await prisma.payment.findMany({
      where: { status: "PAID", bankTransactions: { none: {} } },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return payments.map((p) => ({ id: p.id, label: `${p.customer ? `${p.customer.firstName} ${p.customer.lastName}`.trim() : "Payment"} -- $${(p.amount / 100).toFixed(2)} (${p.createdAt.toISOString().slice(0, 10)})` }));
  }
  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null, bankTransactions: { none: {} } },
    orderBy: { date: "desc" },
    take: 50,
  });
  return expenses.map((e) => ({ id: e.id, label: `${e.vendor || "Expense"} -- $${(e.amount / 100).toFixed(2)} (${e.date.toISOString().slice(0, 10)})` }));
}

export async function confirmMatch(transactionId: string, matchType: "PAYMENT" | "EXPENSE", matchedId: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const tx = await db().bankTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, error: "Transaction not found" };
  if (matchType === "PAYMENT") {
    const payment = await db().payment.findUnique({ where: { id: matchedId } });
    if (!payment) return { ok: false, error: "Payment not found" };
  } else {
    const expense = await db().expense.findUnique({ where: { id: matchedId } });
    if (!expense) return { ok: false, error: "Expense not found" };
  }

  await db().bankTransaction.update({
    where: { id: transactionId },
    data: {
      status: "MATCHED",
      matchedPaymentId: matchType === "PAYMENT" ? matchedId : null,
      matchedExpenseId: matchType === "EXPENSE" ? matchedId : null,
      matchedAt: new Date(),
      matchedById: adminUserId,
    },
  });
  await db().auditLog.create({
    data: { adminUserId, action: "bank_transaction.matched", entityType: "BankTransaction", entityId: transactionId, after: { matchType, matchedId } },
  });
  return { ok: true };
}

/** Explicitly "not a match" / no real counterpart -- never silently disappears, stays visible as IGNORED rather than deleted. */
export async function ignoreTransaction(transactionId: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const tx = await db().bankTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, error: "Transaction not found" };
  await db().bankTransaction.update({ where: { id: transactionId }, data: { status: "IGNORED", matchedAt: new Date(), matchedById: adminUserId } });
  await db().auditLog.create({ data: { adminUserId, action: "bank_transaction.ignored", entityType: "BankTransaction", entityId: transactionId } });
  return { ok: true };
}

export async function unmatchTransaction(transactionId: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const tx = await db().bankTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, error: "Transaction not found" };
  await db().bankTransaction.update({ where: { id: transactionId }, data: { status: "UNMATCHED", matchedPaymentId: null, matchedExpenseId: null, matchedAt: null, matchedById: null } });
  await db().auditLog.create({ data: { adminUserId, action: "bank_transaction.unmatched", entityType: "BankTransaction", entityId: transactionId } });
  return { ok: true };
}

export interface BankSummary {
  total: number;
  unmatched: number;
  matched: number;
  ignored: number;
}

export async function getBankSummary(): Promise<BankSummary> {
  if (!isDatabaseConfigured || !prisma) return { total: 0, unmatched: 0, matched: 0, ignored: 0 };
  const [total, unmatched, matched, ignored] = await Promise.all([
    prisma.bankTransaction.count(),
    prisma.bankTransaction.count({ where: { status: "UNMATCHED" } }),
    prisma.bankTransaction.count({ where: { status: "MATCHED" } }),
    prisma.bankTransaction.count({ where: { status: "IGNORED" } }),
  ]);
  return { total, unmatched, matched, ignored };
}
