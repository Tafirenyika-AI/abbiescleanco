import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { getContactInfo } from "@/lib/server/siteSettings";
import { business } from "@/lib/data/business";
import { PROSPECT_CATEGORIES, PROSPECT_STATUSES, type ProspectCategory, type ProspectStatus, type ProspectRow } from "@/lib/prospects";

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

function mapRow(p: {
  id: string; category: string; businessName: string | null; contactName: string | null;
  phone: string | null; email: string | null; address: string | null; website: string | null;
  source: string; sourceQuery: string | null; status: string; draftSubject: string | null;
  draftBody: string | null; notes: string | null; discoveredAt: Date; contactedAt: Date | null;
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
    discoveredAt: p.discoveredAt.toISOString(),
    contactedAt: p.contactedAt?.toISOString() ?? null,
  };
}

export async function isPlacesSearchConfigured(): Promise<boolean> {
  return !!(await getIntegrationValue("googleMapsApiKey", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
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
}

/** Searches Google Places for businesses matching a query, storing any not already known as new
 *  prospects (deduped by Google's own place id). Never contacts anyone -- this only discovers. */
export async function searchAndSaveProspects(query: string, category: ProspectCategory): Promise<SearchProspectsResult> {
  const apiKey = await getIntegrationValue("googleMapsApiKey", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  if (!apiKey) return { ok: false, error: "Google Places isn't configured yet — add a Google Maps API key in Settings → Integrations." };

  let results: PlaceResult[];
  try {
    results = await callPlacesTextSearch(apiKey, query);
  } catch {
    return { ok: false, error: "Couldn't reach Google Places right now. Please try again shortly." };
  }
  if (results.length === 0) return { ok: true, found: 0, new: 0, duplicates: 0 };

  let created = 0;
  for (const r of results) {
    const existing = await db().prospect.findUnique({ where: { sourcePlaceId: r.placeId } });
    if (existing) continue;
    await db().prospect.create({
      data: {
        category,
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
  return { ok: true, found: results.length, new: created, duplicates: results.length - created };
}

export async function listProspects(filters: { status?: ProspectStatus; category?: ProspectCategory } = {}): Promise<ProspectRow[]> {
  const rows = await db().prospect.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.category ? { category: filters.category } : {}) },
    orderBy: { discoveredAt: "desc" },
    take: 300,
  });
  return rows.map(mapRow);
}

export async function getProspectById(id: string): Promise<ProspectRow | null> {
  const row = await db().prospect.findUnique({ where: { id } });
  return row ? mapRow(row) : null;
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
    LOCAL_BUSINESS: `I provide recurring commercial cleaning for local businesses in ${areas} — a consistent, insured crew on a schedule that fits your hours.`,
    HOMEOWNER: `Welcome to the neighborhood! I run a local residential cleaning service in ${areas} and wanted to say hello in case a move-in or ongoing clean would help.`,
    OTHER: `I run a local cleaning service in ${areas} and wanted to introduce ourselves.`,
  };

  const subject = `Cleaning services for ${p.businessName || "you"} — Abbie's Clean Method`;
  const body = [
    `Hi ${who},`,
    "",
    openers[(p.category as ProspectCategory) ?? "OTHER"],
    "",
    `We're ${business.name}, based in ${business.city}, ${business.region}. Happy to send over pricing or answer any questions — no pressure at all.`,
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
  });
  return mapRow(updated);
}

export async function updateProspect(
  id: string,
  data: { status?: ProspectStatus; notes?: string; draftSubject?: string; draftBody?: string }
): Promise<ProspectRow | null> {
  const existing = await db().prospect.findUnique({ where: { id } });
  if (!existing) return null;
  const updated = await db().prospect.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.draftSubject !== undefined ? { draftSubject: data.draftSubject || null } : {}),
      ...(data.draftBody !== undefined ? { draftBody: data.draftBody || null } : {}),
    },
  });
  return mapRow(updated);
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
