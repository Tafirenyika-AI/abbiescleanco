import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { business } from "@/lib/data/business";
import { KEYWORD_CATEGORIES, KEYWORD_PRIORITIES, type KeywordCategoryValue, type KeywordPriorityValue, type KeywordOpportunityRow } from "@/lib/keywords";

export { KEYWORD_CATEGORIES, KEYWORD_PRIORITIES, SUGGESTED_SEED_KEYWORDS, type KeywordCategoryValue, type KeywordPriorityValue, type KeywordOpportunityRow } from "@/lib/keywords";

/**
 * Keyword Opportunity Engine. Real Google Ads Keyword Planner data needs a live Ads API
 * connection -- this account's connection is currently dead (refresh token revoked, confirmed
 * live 2026-10-11) and reconnecting it was deferred at the owner's request. So real search
 * volume/CPC/competition numbers come from the admin pasting in what Google's own free Keyword
 * Planner UI already shows them (a real, permitted, zero-cost data source), never fabricated or
 * guessed here. AI only classifies category/intent and ranks priority -- it never invents a
 * numeric metric; `source` on each row says plainly where its numbers (if any) came from.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  return prisma;
}

function mapRow(r: {
  id: string; keyword: string; category: string; intent: string | null; priority: string;
  reasoning: string | null; searchVolume: number | null; cpcCents: number | null;
  competition: string | null; source: string; importedAt: Date; updatedAt: Date;
}): KeywordOpportunityRow {
  return {
    id: r.id,
    keyword: r.keyword,
    category: (KEYWORD_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as KeywordCategoryValue) : "RESIDENTIAL",
    intent: r.intent,
    priority: (KEYWORD_PRIORITIES as readonly string[]).includes(r.priority) ? (r.priority as KeywordPriorityValue) : "MEDIUM",
    reasoning: r.reasoning,
    searchVolume: r.searchVolume,
    cpcCents: r.cpcCents,
    competition: r.competition,
    source: r.source,
    importedAt: r.importedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function isKeywordClassifierConfigured(): Promise<boolean> {
  return !!(await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY"));
}

export async function listKeywordOpportunities(): Promise<KeywordOpportunityRow[]> {
  const rows = await db().keywordOpportunity.findMany({ orderBy: [{ priority: "desc" }, { keyword: "asc" }], take: 500 });
  // Prisma returns enum priority alphabetically with "desc" (HIGH, MEDIUM, LOW is NOT alphabetical
  // desc -- it's LOW, MEDIUM, HIGH alphabetically ascending, so desc gives MEDIUM, LOW, HIGH). Sort
  // properly in application code instead of relying on enum ordering.
  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return rows.map(mapRow).sort((a, b) => order[a.priority] - order[b.priority] || a.keyword.localeCompare(b.keyword));
}

export async function deleteKeywordOpportunity(id: string): Promise<{ ok: boolean }> {
  await db().keywordOpportunity.delete({ where: { id } }).catch(() => null);
  return { ok: true };
}

export interface ParsedKeywordLine {
  keyword: string;
  searchVolume: number | null;
  cpcCents: number | null;
  competition: string | null;
}

/**
 * Accepts either a plain one-keyword-per-line list, or comma-separated lines matching what
 * Google's free Keyword Planner UI export looks like: "keyword, avg monthly searches, top of
 * page bid (high range), competition". Unparseable/missing numeric fields are left null, never
 * defaulted to zero (a real "no data" is different from a real "zero searches").
 */
export function parseKeywordImportText(text: string): ParsedKeywordLine[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: ParsedKeywordLine[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    const keyword = parts[0]?.replace(/^"|"$/g, "").trim();
    if (!keyword || keyword.length > 150) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const volumeRaw = parts[1]?.replace(/[^0-9.]/g, "");
    const searchVolume = volumeRaw && !Number.isNaN(Number(volumeRaw)) ? Math.round(Number(volumeRaw)) : null;

    const cpcRaw = parts[2]?.replace(/[^0-9.]/g, "");
    const cpcCents = cpcRaw && !Number.isNaN(Number(cpcRaw)) ? Math.round(Number(cpcRaw) * 100) : null;

    const competition = parts[3] ? parts[3].slice(0, 20) : null;

    result.push({ keyword, searchVolume, cpcCents, competition });
  }
  return result.slice(0, 200);
}

interface AiClassification {
  keyword: string;
  category: KeywordCategoryValue;
  intent: string;
  priority: KeywordPriorityValue;
  reasoning: string;
}

/**
 * AI classifies category/intent/priority only -- it is never given, and must never produce, a
 * search-volume or CPC number. Batches in groups of 25 to keep each call's output bounded and
 * keep cost/latency reasonable (per the brief's own "avoid unnecessary LLM calls" instruction).
 */
async function classifyKeywordsBatch(keywords: string[]): Promise<Map<string, AiClassification>> {
  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  const result = new Map<string, AiClassification>();
  if (!apiKey || keywords.length === 0) return result;

  const areas = business.areaServed.join(", ");
  const prompt = `${business.name} is a real residential/commercial cleaning company serving ${areas}, currently testing paid search with a small $2/day budget. Classify each of these real keywords a search-ads admin is considering. For each one:

- "category": "RESIDENTIAL" or "COMMERCIAL" based on who would search it.
- "intent": a short label (max 10 words) describing the real search intent, e.g. "Move-out cleaning, high booking intent" or "Cleaning-job seeker, not a customer".
- "priority": "HIGH" if it shows direct service-buying intent with good recurring-revenue potential, "MEDIUM" if plausible but less direct, "LOW" if it's actually job-seeker/DIY/equipment-shopping/franchise/training intent or clearly not someone ready to hire a cleaner (these are negative-keyword candidates, not ad targets).
- "reasoning": one real sentence explaining the priority, referencing the keyword's own wording.

Do NOT invent or guess a search volume, CPC, or competition level -- you are not given real numbers for these and must never produce one.

Keywords (respond with one object per keyword, in this exact order, as a JSON array with ONLY these fields: keyword, category, intent, priority, reasoning):
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}

Respond with ONLY the JSON array, nothing else.`;

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    for (const item of parsed) {
      if (
        item && typeof item.keyword === "string" &&
        (KEYWORD_CATEGORIES as readonly string[]).includes(item.category) &&
        (KEYWORD_PRIORITIES as readonly string[]).includes(item.priority) &&
        typeof item.intent === "string" && typeof item.reasoning === "string"
      ) {
        result.set(item.keyword.toLowerCase(), item as AiClassification);
      }
    }
  } catch {
    // best-effort -- rows this batch couldn't classify just keep a neutral default, never block the import
  }
  return result;
}

export interface ImportKeywordsResult {
  ok: boolean;
  error?: string;
  imported?: number;
  classified?: number;
}

export async function importKeywords(lines: ParsedKeywordLine[]): Promise<ImportKeywordsResult> {
  if (!isDatabaseConfigured || !prisma) return { ok: false, error: "Database not configured" };
  if (lines.length === 0) return { ok: false, error: "No keywords to import" };

  const BATCH_SIZE = 25;
  const classifications = new Map<string, AiClassification>();
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE).map((l) => l.keyword);
    const batchResult = await classifyKeywordsBatch(batch);
    for (const [k, v] of batchResult) classifications.set(k, v);
  }

  let imported = 0;
  for (const line of lines) {
    const ai = classifications.get(line.keyword.toLowerCase());
    await prisma.keywordOpportunity.upsert({
      where: { keyword: line.keyword },
      create: {
        keyword: line.keyword,
        category: ai?.category ?? (/\b(office|commercial|janitorial|dental|medical|business)\b/i.test(line.keyword) ? "COMMERCIAL" : "RESIDENTIAL"),
        intent: ai?.intent ?? null,
        priority: ai?.priority ?? "MEDIUM",
        reasoning: ai?.reasoning ?? (ai ? null : "AI classification unavailable this import -- defaulted to Medium, review manually."),
        searchVolume: line.searchVolume,
        cpcCents: line.cpcCents,
        competition: line.competition,
        source: "manual_import",
      },
      update: {
        ...(ai ? { category: ai.category, intent: ai.intent, priority: ai.priority, reasoning: ai.reasoning } : {}),
        ...(line.searchVolume !== null ? { searchVolume: line.searchVolume } : {}),
        ...(line.cpcCents !== null ? { cpcCents: line.cpcCents } : {}),
        ...(line.competition !== null ? { competition: line.competition } : {}),
      },
    });
    imported++;
  }

  return { ok: true, imported, classified: classifications.size };
}
