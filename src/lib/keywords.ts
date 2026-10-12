/** Client-safe keyword-opportunity types/constants — no server-only imports (Prisma, fs). */

export const KEYWORD_CATEGORIES = ["RESIDENTIAL", "COMMERCIAL"] as const;
export type KeywordCategoryValue = (typeof KEYWORD_CATEGORIES)[number];

export const KEYWORD_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type KeywordPriorityValue = (typeof KEYWORD_PRIORITIES)[number];

export interface KeywordOpportunityRow {
  id: string;
  keyword: string;
  category: KeywordCategoryValue;
  intent: string | null;
  priority: KeywordPriorityValue;
  reasoning: string | null;
  searchVolume: number | null;
  cpcCents: number | null;
  competition: string | null;
  source: string;
  importedAt: string;
  updatedAt: string;
}

/**
 * The brief's own example seed keywords -- a plain starting list for the admin to import,
 * research real numbers for via Google's free Keyword Planner, or just get an initial AI
 * priority read on before spending anything. Not real search data, just phrasing suggestions.
 */
export const SUGGESTED_SEED_KEYWORDS = [
  "house cleaning Spokane Valley WA",
  "house cleaners near me",
  "cleaning services Spokane Valley",
  "deep cleaning Spokane Valley",
  "move out cleaning Spokane Valley",
  "move in cleaning Spokane",
  "recurring house cleaning Spokane",
  "maid service Spokane Valley",
  "commercial cleaning Spokane Valley",
  "office cleaning Spokane Valley",
  "janitorial services Spokane",
  "commercial cleaning company near me",
  "dental office cleaning Spokane",
  "medical office cleaning Spokane",
  "business cleaning services Spokane",
  "office janitorial services",
];
