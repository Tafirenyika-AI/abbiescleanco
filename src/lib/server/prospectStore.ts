import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { getContactInfo } from "@/lib/server/siteSettings";
import { business } from "@/lib/data/business";
import { PROSPECT_CATEGORIES, PROSPECT_STATUSES, prospectCategoryLabels, type ProspectCategory, type ProspectStatus, type ProspectRow } from "@/lib/prospects";

export { PROSPECT_CATEGORIES, prospectCategoryLabels, PROSPECT_STATUSES, prospectStatusLabels, type ProspectCategory, type ProspectStatus, type ProspectRow } from "@/lib/prospects";

/**
 * Prospecting: finding potential new customers (property managers, realtors, local businesses)
 * who haven't contacted us yet, as opposed to `leadStore.ts` which handles people who already
 * submitted a real request. Discovery uses Google Places; outreach is always drafted and requires
 * an explicit admin send -- nothing here is ever sent automatically, matching the blueprint's own
 * "AI prepares, human approves" rule and avoiding the real legal exposure (TCPA/CAN-SPAM) of
 * unsolicited automated outreach to people who never opted in.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Database not configured");
  return prisma;
}

// Real, found bug (2026-09-24): a vague admin query passed straight through to Google Places
// literally can and did return other cleaning/janitorial/dry-cleaning businesses (e.g. "Cascade
// Cleaners") as "prospects" -- those are competitors, never a real customer. This is a second,
// independent safety net applied to every discovered result regardless of source or how the
// underlying query was built, on top of (not instead of) any AI query-planning/prompt-level
// exclusion instruction.
const COMPETITOR_NAME_PATTERN = /\b(clean(?:ing|ers?)?|maid[s]?|janitorial|janitor|housekeep(?:ing|er)?|dry[\s-]?clean(?:ing|ers?)?)\b/i;
function looksLikeCleaningCompetitor(name: string): boolean {
  return COMPETITOR_NAME_PATTERN.test(name);
}

// Cross-source duplicate detection. Each discovery path already dedupes against ITSELF exactly
// (Google Places by its own stable place id, the web-intent search by exact post URL), but that
// misses real near-duplicates: the same business found again under a slightly different Places
// listing, the same phone number reappearing from a different query, or the same site with/
// without "www."/a trailing slash. This checks every NEW result against the prospects already in
// the database by phone, website hostname, and normalized business name before it's ever saved.
function normalizeForDedup(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function normalizeHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
async function findLikelyDuplicate(input: { businessName?: string | null; phone?: string | null; website?: string | null }): Promise<boolean> {
  if (input.phone) {
    const byPhone = await db().prospect.findFirst({ where: { phone: input.phone } });
    if (byPhone) return true;
  }
  const hostname = normalizeHostname(input.website);
  const normName = normalizeForDedup(input.businessName);
  if (hostname || normName) {
    const candidates = await db().prospect.findMany({ select: { businessName: true, website: true } });
    for (const c of candidates) {
      if (hostname && normalizeHostname(c.website) === hostname) return true;
      if (normName && normalizeForDedup(c.businessName) === normName) return true;
    }
  }
  return false;
}

function mapRow(p: {
  id: string; category: string; businessName: string | null; contactName: string | null;
  phone: string | null; email: string | null; address: string | null; website: string | null;
  source: string; sourceQuery: string | null; status: string; draftSubject: string | null;
  draftBody: string | null; notes: string | null; discoveredAt: Date; contactedAt: Date | null;
  assignedToId: string | null; assignedTo?: { name: string } | null;
  researchNotes: string | null; researchSources: unknown; researchedAt: Date | null;
  convertedLeadId: string | null; convertedLead?: { reference: string } | null;
}): ProspectRow {
  return {
    id: p.id,
    category: (PROSPECT_CATEGORIES as readonly string[]).includes(p.category) ? (p.category as ProspectCategory) : "OTHER",
    businessName: p.businessName,
    contactName: p.contactName,
    phone: p.phone,
    email: p.email,
    address: p.address,
    website: p.website,
    source: p.source,
    sourceQuery: p.sourceQuery,
    status: (PROSPECT_STATUSES as readonly string[]).includes(p.status) ? (p.status as ProspectStatus) : "NEW",
    draftSubject: p.draftSubject,
    draftBody: p.draftBody,
    notes: p.notes,
    assignedToId: p.assignedToId,
    assignedToName: p.assignedTo?.name ?? null,
    researchNotes: p.researchNotes,
    researchSources: Array.isArray(p.researchSources) ? (p.researchSources as { url: string; title: string }[]) : null,
    researchedAt: p.researchedAt?.toISOString() ?? null,
    convertedLeadId: p.convertedLeadId,
    convertedLeadReference: p.convertedLead?.reference ?? null,
    discoveredAt: p.discoveredAt.toISOString(),
    contactedAt: p.contactedAt?.toISOString() ?? null,
  };
}

const PROSPECT_INCLUDE = { assignedTo: { select: { name: true } }, convertedLead: { select: { reference: true } } } as const;

export async function isPlacesSearchConfigured(): Promise<boolean> {
  return !!(await getIntegrationValue("googleMapsApiKey", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
}

export async function isWebLeadSearchConfigured(): Promise<boolean> {
  return !!(await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY"));
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
}

/** Calls the real Google Places API (New) Text Search endpoint. Base URL is overridable so this
 *  can be exercised against a local mock server in tests without a live key. */
async function callPlacesTextSearch(apiKey: string, query: string): Promise<PlaceResult[]> {
  const baseUrl = (process.env.GOOGLE_PLACES_BASE_URL || "https://places.googleapis.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/v1/places:searchText`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({ textQuery: query }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  const data = (await res.json()) as {
    places?: { id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; websiteUri?: string }[];
  };
  return (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text || "Unnamed business",
    address: p.formattedAddress || "",
    phone: p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
  }));
}

export interface SearchProspectsResult {
  ok: boolean;
  error?: string;
  found?: number;
  new?: number;
  duplicates?: number;
  excludedCompetitors?: number;
  queriesRun?: string[];
}

interface QueryPlan {
  query: string;
  category: ProspectCategory;
}

/**
 * Turns the admin's plain-English description of who they're looking for into concrete, real
 * Google Places search queries. Real bug this fixes (2026-09-24): the search box previously sent
 * whatever the admin typed straight to Google Places as a literal text query with zero
 * interpretation -- an admin describing intent in a full sentence ("search for those who might
 * be our potential clients") got matched by Google on stray words in that sentence and returned
 * actual cleaning/dry-cleaning competitors, not real prospects. Every planned query is explicitly
 * scoped to the real service area and told to target businesses that could realistically HIRE a
 * cleaning company (property managers, realtors, HOAs, offices, medical/dental, gyms, daycares,
 * short-term rental hosts, event venues), never other cleaning/janitorial businesses.
 */
async function planPlacesQueries(intent: string): Promise<{ ok: true; plans: QueryPlan[] } | { ok: false; error: string }> {
  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  if (!apiKey) return { ok: false, error: "no Anthropic key" };

  const areas = business.areaServed.join(", ");
  const prompt = `${business.name} is a residential/commercial cleaning company. An admin wants to find REAL POTENTIAL CUSTOMERS near ${areas} using Google Places search. Here is what they typed, in their own words (it may be a full sentence, not a search query): "${intent}"

Turn this into 1-4 concrete, well-formed Google Places text-search queries that will find real organizations that could realistically HIRE a cleaning company -- for example property management companies, real estate agencies, HOAs, medical/dental offices, gyms, daycares, event venues, short-term rental hosts, office buildings. Each query should read like a natural Google Places search string, e.g. "property management company Spokane Valley WA", scoped to the real service area above.

CRITICAL: never produce a query that would mainly return other cleaning, janitorial, maid, housekeeping, or dry-cleaning businesses -- those are competitors, not prospects, even if the admin's own wording mentions "cleaners."

Respond with ONLY a JSON array, nothing else. One object per query: {"query": "...", "category": one of "HOMEOWNER", "LOCAL_BUSINESS", "PROPERTY_MANAGER", "OTHER"}.`;

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    const plans = parsed.filter(
      (p): p is QueryPlan => p && typeof p.query === "string" && p.query.trim().length > 0 && (PROSPECT_CATEGORIES as readonly string[]).includes(p.category)
    );
    if (plans.length === 0) throw new Error("no usable plans");
    return { ok: true, plans };
  } catch {
    return { ok: false, error: "query planning failed" };
  }
}

/** Searches Google Places for businesses matching the admin's request, storing any not already
 *  known as new prospects. Never contacts anyone -- this only discovers. When Anthropic is
 *  configured, the admin's plain-English description is first turned into real, targeted Places
 *  queries (see planPlacesQueries); otherwise falls back to sending the typed text straight to
 *  Places, same as before. Every result is checked against looksLikeCleaningCompetitor() before
 *  being saved, so a competitor can never slip through. Deduped two ways: exactly, by Google's own
 *  stable place id (catches the same listing returned again by a later search), and by
 *  findLikelyDuplicate() -- phone number, website hostname, or normalized business name against
 *  every prospect already on file -- which catches the same real business surfacing under a
 *  second, different Places listing (a known real Google Places data-quality issue). */
export async function searchAndSaveProspects(query: string, category: ProspectCategory): Promise<SearchProspectsResult> {
  const apiKey = await getIntegrationValue("googleMapsApiKey", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  if (!apiKey) return { ok: false, error: "Google Places isn't configured yet, add a Google Maps API key in Settings → Integrations." };

  const planned = await planPlacesQueries(query);
  const plans: QueryPlan[] = planned.ok ? planned.plans : [{ query, category }];

  const allResults: { result: PlaceResult; category: ProspectCategory }[] = [];
  for (const plan of plans) {
    try {
      const results = await callPlacesTextSearch(apiKey, plan.query);
      for (const r of results) allResults.push({ result: r, category: plan.category });
    } catch {
      // one query in the plan failing shouldn't sink the whole search -- continue with the rest
    }
  }
  if (allResults.length === 0 && plans.length === 1 && plans[0].query === query) {
    return { ok: false, error: "Couldn't reach Google Places right now. Please try again shortly." };
  }

  const seenPlaceIds = new Set<string>();
  const deduped = allResults.filter(({ result }) => {
    if (seenPlaceIds.has(result.placeId)) return false;
    seenPlaceIds.add(result.placeId);
    return true;
  });

  let created = 0;
  let duplicates = 0;
  let excludedCompetitors = 0;
  for (const { result: r, category: cat } of deduped) {
    if (looksLikeCleaningCompetitor(r.name)) {
      excludedCompetitors++;
      continue;
    }
    const existing = await db().prospect.findUnique({ where: { sourcePlaceId: r.placeId } });
    if (existing) {
      duplicates++;
      continue;
    }
    if (await findLikelyDuplicate({ businessName: r.name, phone: r.phone, website: r.website })) {
      duplicates++;
      continue;
    }
    await db().prospect.create({
      data: {
        category: cat,
        businessName: r.name,
        address: r.address || null,
        phone: r.phone,
        website: r.website,
        source: "google_places",
        sourcePlaceId: r.placeId,
        sourceQuery: query,
      },
    });
    created++;
  }
  return {
    ok: true,
    found: deduped.length,
    new: created,
    duplicates,
    excludedCompetitors,
    queriesRun: plans.map((p) => p.query),
  };
}

interface WebOpportunity {
  url: string;
  title: string;
  snippet: string;
  postedDate: string | null;
  category: ProspectCategory;
}

/**
 * Searches the real, OPEN web (via Claude's web_search tool, same proven mechanism as
 * researchProspect below) for RECENT public posts where someone -- a homeowner or a local
 * business -- is actively looking to hire a cleaning service right now. Deliberately NOT
 * restricted to a fixed platform list: the prompt tells the model to search broadly (general
 * Google-indexed web search across whatever real sites turn up results), not just the handful
 * of named examples given as a starting point. This is a fundamentally different, higher-intent
 * discovery channel than Google Places: those are businesses that MIGHT need cleaning someday,
 * these are people who've just said, publicly, that they need one now -- reaching out while that
 * need is still live is the real advantage. Every result is a genuine web_search hit
 * (cross-checked against the response's own citations, not just trusted text) with a real source
 * link; nothing here ever auto-contacts anyone -- these posts rarely expose a direct email/phone,
 * so the realistic, honest next step is always the admin opening the real post and replying there
 * themselves, same "AI finds, human reaches out" pattern as every other prospect.
 *
 * Also checks Craigslist-style "jobs" sections for a real but easy-to-miss case: a private
 * individual paying someone directly to clean their own home, mistakenly posted under "jobs"
 * instead of "services wanted." This is deliberately filtered hard against the much more common
 * false-positive in that section -- a cleaning/janitorial COMPANY recruiting an EMPLOYEE to clean
 * on its behalf (a competitor's staffing ad, not a prospect) -- via explicit criteria in the
 * prompt (fixed shift/wage/resume language = employer hiring staff, excluded; informal "pay
 * someone to clean my own house" language = a real prospect, included).
 */
export async function searchWebForCleaningLeads(): Promise<SearchProspectsResult> {
  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  if (!apiKey) return { ok: false, error: "Anthropic isn't configured yet, add an API key in Settings → Integrations." };

  const areas = business.areaServed.join(", ");
  const today = new Date().toISOString().slice(0, 10);
  const query = `Search the OPEN WEB -- general search, not limited to any fixed list of sites -- for REAL, RECENT (within about the last 14 days -- today is ${today}) public posts where an individual homeowner or a local business in or very near ${areas} is actively looking for, needs, or wants to hire a house or commercial cleaning service right now.

Run several different searches with different phrasings and check as many distinct real sources as you can, rather than stopping after the first result. Cast a wide net across whatever platforms genuinely turn up matches -- these commonly include (but are NOT limited to): Craigslist "gigs"/"services wanted", Nextdoor, public Facebook posts/groups and Facebook Marketplace "services" requests, Reddit (including local city/neighborhood subreddits), X/Twitter, local community forums and classifieds, and job-request marketplaces where homeowners post a cleaning job for providers to bid on (Thumbtack, Angi, TaskRabbit, Bark, Care.com). Also just run plain general searches (e.g. "need a house cleaner [city]", "looking for cleaning service [city]") the way a real person would Google it, and see what genuinely comes back -- don't assume in advance which site will have the answer.

Also check Craigslist's (and similar sites') "jobs"/"general labor" section, since a private individual sometimes mistakenly posts there instead of "gigs"/"services wanted" when they just want to pay someone to clean their own home. Include a "jobs"-section post ONLY if it clearly reads as a private person paying someone directly to clean THEIR OWN home/property (informal, e.g. "need someone to clean my house every other week, cash/Venmo, flexible hours"). Do NOT include a "jobs"-section post if it's a company/business recruiting an EMPLOYEE to clean OTHER people's homes/offices on the company's behalf (fixed shift schedule, hourly wage stated as pay for labor, "must have reliable vehicle", asks for a resume/references, mentions being part of an existing cleaning/janitorial company) -- that's a competitor's staffing ad, not a prospect, and must be excluded even though it also mentions "cleaning."

Do NOT include posts from cleaning companies advertising their OWN services to customers, or recruiting staff to work FOR them -- only posts from someone seeking to HIRE a cleaner for their own home/property. Do NOT include anything you can't reasonably tell is recent (roughly the last 2-3 weeks) -- skip it rather than guess. Do NOT limit yourself to the example sites above if a real search turns up a genuine match somewhere else.

Respond with ONLY a JSON array, nothing else before or after it. One object per genuine match, with exactly these fields: "url" (the real source URL from your search), "title" (a short label for it), "snippet" (what they're actually asking for, in their own words where possible), "postedDate" (the real date or relative time if stated, e.g. "3 days ago" or "2026-09-20", else null), "category" (one of "HOMEOWNER", "LOCAL_BUSINESS", "PROPERTY_MANAGER", "OTHER" based on who's asking). If you find nothing genuine, respond with exactly [].`;

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  let text = "";
  const citedUrls = new Set<string>();
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 12 }],
        messages: [{ role: "user", content: query }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string; citations?: { url?: string }[] }[] };
    const textBlocks = (data.content ?? []).filter((c) => c.type === "text");
    text = textBlocks.map((b) => b.text ?? "").join("\n").trim();
    for (const b of textBlocks) for (const c of b.citations ?? []) if (c.url) citedUrls.add(c.url);
  } catch {
    return { ok: false, error: "Couldn't complete the web search right now. Please try again shortly." };
  }

  let findings: WebOpportunity[];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    findings = parsed.filter(
      (f): f is WebOpportunity =>
        f && typeof f.url === "string" && typeof f.title === "string" && typeof f.snippet === "string" && (PROSPECT_CATEGORIES as readonly string[]).includes(f.category)
    );
  } catch {
    return { ok: false, error: "The search didn't return a usable result. Please try again." };
  }
  if (findings.length === 0) return { ok: true, found: 0, new: 0, duplicates: 0 };

  let created = 0;
  let excludedCompetitors = 0;
  for (const f of findings) {
    // Cross-check against the response's own citations -- if the model named a URL that never
    // actually came back from a real search this turn, treat it as unverified and skip it rather
    // than create a prospect from a possibly-invented source.
    if (!citedUrls.has(f.url)) continue;
    // Second, independent layer beyond the prompt's own "don't include companies advertising
    // their own services" instruction -- a prompt instruction alone is never fully trusted here.
    if (looksLikeCleaningCompetitor(f.title)) {
      excludedCompetitors++;
      continue;
    }
    const existing = await db().prospect.findFirst({ where: { website: f.url } });
    if (existing) continue;
    await db().prospect.create({
      data: {
        category: f.category,
        businessName: f.title.slice(0, 200),
        website: f.url,
        source: "web_intent_search",
        sourceQuery: `Looking-for-a-cleaner search, ${today}`,
        notes: `Found via web search -- actively looking for cleaning help.${f.postedDate ? ` Posted ${f.postedDate}.` : ""}\n\n"${f.snippet}"\n\nNo direct contact info from this source -- open the real post to reply.`,
      },
    });
    created++;
  }
  const verifiedFound = findings.filter((f) => citedUrls.has(f.url)).length;
  return { ok: true, found: verifiedFound, new: created, duplicates: verifiedFound - created - excludedCompetitors, excludedCompetitors };
}

export async function listProspects(filters: { status?: ProspectStatus; category?: ProspectCategory } = {}): Promise<ProspectRow[]> {
  const rows = await db().prospect.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.category ? { category: filters.category } : {}) },
    include: PROSPECT_INCLUDE,
    orderBy: { discoveredAt: "desc" },
    take: 300,
  });
  return rows.map(mapRow);
}

export async function getProspectById(id: string): Promise<ProspectRow | null> {
  const row = await db().prospect.findUnique({ where: { id }, include: PROSPECT_INCLUDE });
  return row ? mapRow(row) : null;
}

export interface AssignableAdmin {
  id: string;
  name: string;
}

/** Active admin users who can be assigned as the responsible contact for a prospect. */
export async function listAssignableAdmins(): Promise<AssignableAdmin[]> {
  const { listAdminUsers } = await import("@/lib/server/adminUsers");
  const admins = await listAdminUsers();
  return admins.filter((a) => a.isActive).map((a) => ({ id: a.id, name: a.name }));
}

/**
 * Deterministic, template-based outreach draft -- no model call. Personalizes on real data only
 * (the prospect's own name/category, our real service area and contact info); never invents a
 * relationship or claim that hasn't happened. An admin always reviews/edits before anything sends.
 */
export async function draftOutreachForProspect(id: string): Promise<ProspectRow | null> {
  const p = await db().prospect.findUnique({ where: { id } });
  if (!p) return null;
  const contact = await getContactInfo();
  const areas = business.areaServed.slice(0, 3).join(", ");
  const who = p.businessName || p.contactName || "there";

  const openers: Record<ProspectCategory, string> = {
    PROPERTY_MANAGER: `I help property managers in ${areas} keep turnover cleaning fast and reliable between tenants, so units are guest-ready without you having to chase it.`,
    REALTOR: `I work with local realtors on move-in and move-out cleaning so listings show well and closings aren't held up waiting on a clean.`,
    LOCAL_BUSINESS: `I provide recurring commercial cleaning for local businesses in ${areas}, a consistent, insured crew on a schedule that fits your hours.`,
    HOMEOWNER: `Welcome to the neighborhood! I run a local residential cleaning service in ${areas} and wanted to say hello in case a move-in or ongoing clean would help.`,
    OTHER: `I run a local cleaning service in ${areas} and wanted to introduce ourselves.`,
  };

  const subject = `Cleaning services for ${p.businessName || "you"}, Abbie's Clean Method`;
  const body = [
    `Hi ${who},`,
    "",
    openers[(p.category as ProspectCategory) ?? "OTHER"],
    "",
    `We're ${business.name}, based in ${business.city}, ${business.region}. Happy to send over pricing or answer any questions, no pressure at all.`,
    "",
    `You can reach me directly at ${contact.phoneDisplay} or ${contact.email}, or reply to this email.`,
    "",
    "Thanks,",
    business.name,
    "",
    `If you'd rather not hear from us again, just reply and let us know and we won't reach out further.`,
  ].join("\n");

  const updated = await db().prospect.update({
    where: { id },
    data: { draftSubject: subject, draftBody: body, status: p.status === "NEW" ? "DRAFTED" : p.status },
    include: PROSPECT_INCLUDE,
  });
  return mapRow(updated);
}

export async function updateProspect(
  id: string,
  data: {
    status?: ProspectStatus; notes?: string; draftSubject?: string; draftBody?: string; assignedToId?: string | null;
    contactName?: string; email?: string; phone?: string; address?: string;
  }
): Promise<ProspectRow | null> {
  const existing = await db().prospect.findUnique({ where: { id } });
  if (!existing) return null;
  if (data.assignedToId) {
    const admin = await db().adminUser.findUnique({ where: { id: data.assignedToId } });
    if (!admin) return null;
  }
  const updated = await db().prospect.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.draftSubject !== undefined ? { draftSubject: data.draftSubject || null } : {}),
      ...(data.draftBody !== undefined ? { draftBody: data.draftBody || null } : {}),
      ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId || null } : {}),
      ...(data.contactName !== undefined ? { contactName: data.contactName || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
    },
    include: PROSPECT_INCLUDE,
  });
  return mapRow(updated);
}

export interface ResearchResult {
  ok: boolean;
  error?: string;
  prospect?: ProspectRow;
}

/**
 * Real web research via Claude's web_search tool -- run on-demand per prospect (an explicit admin
 * click, never automatic), looking for a prospect's real social media presence (Facebook,
 * Instagram, LinkedIn), where they're listed online (Google Business Profile, Yelp, BBB), and
 * genuine public information (reviews, complaints, posts) related to cleaning. Reports honestly
 * when nothing is found rather than inventing a profile/URL that doesn't exist; every claim comes
 * with a real, clickable source URL from the search results (rendered in the admin UI).
 */
export async function researchProspect(id: string): Promise<ResearchResult> {
  const p = await db().prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Not found" };

  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  if (!apiKey) return { ok: false, error: "Anthropic isn't configured yet, add an API key in Settings → Integrations." };

  const who = p.businessName || p.contactName || "this business";
  const location = p.address || business.city;
  const query = `Search the web for real, public information about "${who}" (${location}) that's useful to a cleaning company considering reaching out to them. Specifically look for and cite:
1. Their real social media presence -- Facebook Page, Instagram, LinkedIn -- if they have one.
2. Where they're listed online -- Google Business Profile, Yelp, BBB, or a local business directory.
3. Recent reviews, complaints, or posts mentioning cleanliness or a need for cleaning services.
4. How large/established the business appears to be, and anything else useful before contacting them.

Only report things you actually find -- if you can't find a real social media profile or listing for them, say so plainly rather than guessing or inventing a URL. Keep the summary under 200 words and cite every real source you used.`;

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  let text = "";
  const sources: { url: string; title: string }[] = [];
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 1200,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
        messages: [{ role: "user", content: query }],
      }),
      signal: AbortSignal.timeout(75_000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string; citations?: { url?: string; title?: string }[] }[];
    };
    const textBlocks = (data.content ?? []).filter((c) => c.type === "text");
    text = textBlocks.map((b) => b.text ?? "").join("\n\n").trim();
    const seen = new Set<string>();
    for (const b of textBlocks) {
      for (const c of b.citations ?? []) {
        if (c.url && c.title && !seen.has(c.url)) {
          seen.add(c.url);
          sources.push({ url: c.url, title: c.title });
        }
      }
    }
  } catch {
    return { ok: false, error: "Couldn't complete research right now. Please try again shortly." };
  }
  if (!text) return { ok: false, error: "Research didn't return a usable result. Please try again." };

  const updated = await db().prospect.update({
    where: { id },
    data: { researchNotes: text, researchSources: sources as object, researchedAt: new Date() },
    include: PROSPECT_INCLUDE,
  });
  return { ok: true, prospect: mapRow(updated) };
}

export interface SendOutreachResult {
  ok: boolean;
  error?: string;
}

/** Sends the (admin-reviewed, possibly edited) draft via email. The explicit admin call to this
 *  function IS the human-approval step -- nothing upstream of this ever sends on its own. */
export async function sendProspectOutreach(id: string): Promise<SendOutreachResult> {
  const { sendEmail } = await import("@/lib/server/email");
  const p = await db().prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Not found" };
  if (p.status === "DO_NOT_CONTACT") return { ok: false, error: "This prospect is marked do-not-contact." };
  if (!p.email) return { ok: false, error: "This prospect has no email address on file yet." };
  if (!p.draftSubject || !p.draftBody) return { ok: false, error: "Draft an outreach message first." };

  const result = await sendEmail({ to: p.email, subject: p.draftSubject, html: p.draftBody.replace(/\n/g, "<br>") });
  if (!result.ok) return { ok: false, error: result.error || "Send failed." };

  await db().prospect.update({ where: { id }, data: { status: "SENT", contactedAt: new Date() } });
  return { ok: true };
}

/** Permanently removes a prospect the admin has decided isn't worth tracking. Prospects carry no
 *  audit trail today (unlike leads/customers), so this is a hard delete, not a soft one -- if it's
 *  already converted, only the discovery record goes; the real Lead it became is untouched. */
export async function deleteProspect(id: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().prospect.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Not found" };
  await db().prospect.delete({ where: { id } });
  return { ok: true };
}

export interface ConvertToLeadResult {
  ok: boolean;
  error?: string;
  leadId?: string;
  leadReference?: string;
}

function splitContactName(contactName: string | null, businessName: string | null): { firstName: string; lastName: string } {
  const trimmed = contactName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
    return { firstName: parts[0], lastName: businessName?.trim() || "(Business)" };
  }
  return { firstName: businessName?.trim() || "New", lastName: "(Business)" };
}

/**
 * Turns a real prospect into a real Lead in the same pipeline every inbound customer already goes
 * through -- closing the loop between outbound discovery and the existing quote/booking/payment
 * machinery, rather than building a second, parallel system. Deliberately does NOT invent
 * square-footage/bedroom/bathroom answers: these prospects are businesses (property managers,
 * realtors, commercial accounts), not a single home, so there's no honest number to put there.
 * Uses propertyType "commercial", which the pricing engine already routes straight to a manual
 * quote regardless of the placeholder size fields -- the admin gathers real scope on a real call.
 */
export async function convertProspectToLead(id: string): Promise<ConvertToLeadResult> {
  const p = await db().prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Not found" };
  if (p.convertedLeadId) return { ok: false, error: "This prospect has already been converted to a lead." };
  if (!p.email) return { ok: false, error: "Add an email address for this prospect before converting." };
  if (!p.phone) return { ok: false, error: "Add a phone number for this prospect before converting." };
  const zipMatch = p.address?.match(/\b(\d{5})\b/);
  if (!zipMatch) return { ok: false, error: "This prospect's address needs a 5-digit ZIP code before converting, edit the address first." };

  const { createLead } = await import("@/lib/server/leadStore");
  const { calculateEstimate } = await import("@/lib/pricing");
  const { getPricingConfig } = await import("@/lib/server/pricingStore");

  const { firstName, lastName } = splitContactName(p.contactName, p.businessName);
  const pricingConfig = await getPricingConfig();
  const estimate = calculateEstimate(
    { service: "commercial-cleaning", propertyType: "commercial", squareFeet: 100, bedrooms: 0, bathrooms: 0, condition: "normal", frequency: "one-time", hasPets: false, addOns: [] },
    pricingConfig
  );

  const categoryLabel = prospectCategoryLabels[(p.category as ProspectCategory) ?? "OTHER"];
  const noteParts = [
    `Converted from Prospecting (${categoryLabel}, discovered via ${p.source}${p.sourceQuery ? `, "${p.sourceQuery}"` : ""}).`,
    "Property/scope details are unknown, confirm directly with the contact before quoting.",
    p.notes ? `Prospecting notes: ${p.notes}` : "",
  ].filter(Boolean);

  const { id: leadId, reference } = await createLead(
    {
      firstName,
      lastName,
      email: p.email,
      phone: p.phone,
      service: "commercial-cleaning",
      zip: zipMatch[1],
      propertyType: "commercial",
      squareFeet: 100,
      bedrooms: 0,
      bathrooms: 0,
      condition: "normal",
      frequency: "one-time",
      hasPets: false,
      addOns: [],
      preferredContactMethod: "EMAIL",
      additionalInstructions: noteParts.join(" ").slice(0, 2000),
      smsConsent: false,
      emailConsent: true,
      policiesAccepted: true,
      source: "prospecting",
    },
    estimate
  );

  await db().prospect.update({
    where: { id },
    data: { convertedLeadId: leadId, status: "CONVERTED" },
  });

  return { ok: true, leadId, leadReference: reference };
}
