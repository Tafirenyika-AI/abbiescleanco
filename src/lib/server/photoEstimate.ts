import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { calculateEstimate, type Condition, type PropertyType } from "@/lib/pricing";
import { serviceIds } from "@/lib/validation/quote";
import { HOUSE_WRITING_STYLE } from "@/lib/aiStyle";

export type PhotoServiceId = Exclude<(typeof serviceIds)[number], "commercial-cleaning" | "residential-cleaning" | "laundry-organization">;
const PHOTO_SERVICES = serviceIds.filter((s) => !["commercial-cleaning", "residential-cleaning", "laundry-organization"].includes(s)) as PhotoServiceId[];
const CONDITIONS: Condition[] = ["light", "normal", "heavy", "very-heavy"];

export interface PhotoFinding {
  photo: number; // 1-based
  area: string; // "Kitchen", "Bathroom", ...
  condition: Condition;
  issues: string[]; // e.g. "Heavy grease on stovetop", "Soap scum on shower glass"
}

export interface PhotoAnalysis {
  findings: PhotoFinding[];
  overallCondition: Condition;
  recommendedService: PhotoServiceId;
  suggestedAddOns: string[]; // add-on keys from the pricing config
  petHairVisible: boolean;
  supplies: string[]; // what the crew should bring
  staffNotes: string;
  confidence: "low" | "medium" | "high";
  needsManualReview: boolean;
}

export interface PhotoEstimateInput {
  images: { base64: string }[];
  areaType: string; // free label from the customer, e.g. "Whole home", "Bathroom"
  propertyType: PropertyType;
  squareFeet: number;
  bedrooms: number;
  bathrooms: number;
  hasPets: boolean;
  requestedService?: PhotoServiceId;
}

const API_VERSION = "2023-06-01";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export async function isPhotoAnalysisConfigured(): Promise<boolean> {
  return !!(await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY"));
}

function buildTool(addOnKeys: string[]) {
  return {
    name: "report_cleaning_assessment",
    description: "Report a structured cleaning assessment of the customer's photos.",
    input_schema: {
      type: "object",
      required: ["findings", "overallCondition", "recommendedService", "suggestedAddOns", "petHairVisible", "supplies", "staffNotes", "confidence", "needsManualReview"],
      properties: {
        findings: {
          type: "array",
          items: {
            type: "object",
            required: ["photo", "area", "condition", "issues"],
            properties: {
              photo: { type: "integer", description: "1-based index of the photo" },
              area: { type: "string" },
              condition: { type: "string", enum: CONDITIONS },
              issues: { type: "array", items: { type: "string" }, description: "Specific visible cleaning problems" },
            },
          },
        },
        overallCondition: { type: "string", enum: CONDITIONS },
        recommendedService: { type: "string", enum: PHOTO_SERVICES },
        suggestedAddOns: { type: "array", items: { type: "string", enum: addOnKeys.length ? addOnKeys : ["none"] } },
        petHairVisible: { type: "boolean" },
        supplies: { type: "array", items: { type: "string" }, description: "Products/equipment the crew should bring for what is visible" },
        staffNotes: { type: "string", description: "Short internal note for the cleaning crew" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        needsManualReview: { type: "boolean", description: "True if photos are unclear, unrelated, or show hazards/extreme conditions" },
      },
    },
  };
}

function buildPrompt(input: PhotoEstimateInput, addOns: { key: string; label: string }[]) {
  return [
    "You are assessing photos for a professional residential cleaning company in Spokane Valley, WA.",
    `The customer says this is: ${input.areaType} (${input.propertyType}, about ${input.squareFeet} sq ft, ${input.bedrooms} bed / ${input.bathrooms} bath, pets: ${input.hasPets ? "yes" : "no"}).`,
    input.requestedService ? `They are interested in: ${input.requestedService}.` : "",
    "For each photo, identify the area and how much cleaning it needs (light = well-maintained, normal = everyday, heavy = not cleaned in a while, very-heavy = significant build-up). List specific visible issues only, never guess at things you cannot see.",
    "Choose the single best-fit service and any add-ons the photos justify, using ONLY these add-on keys: " + addOns.map((a) => `${a.key} (${a.label})`).join(", ") + ".",
    "List supplies/equipment the crew should bring for what is visible (e.g. oven cleaner, descaler for hard-water glass, extra microfiber, HEPA vacuum for pet hair).",
    "Do NOT state any prices or hours. If photos are blurry, unrelated to cleaning, or show possible biohazard/mold/damage, set needsManualReview true and confidence low.",
    HOUSE_WRITING_STYLE,
    "Call the report_cleaning_assessment tool with your result.",
  ].filter(Boolean).join("\n");
}

function sanitizeAnalysis(raw: unknown, addOnKeys: string[], photoCount: number): PhotoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cond = (v: unknown): Condition => (CONDITIONS.includes(v as Condition) ? (v as Condition) : "normal");
  const strArr = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 200)).slice(0, max) : []);
  const findings: PhotoFinding[] = Array.isArray(r.findings)
    ? r.findings.slice(0, photoCount * 2).map((f: Record<string, unknown>) => ({
        photo: Math.min(Math.max(Number(f.photo) || 1, 1), photoCount),
        area: String(f.area ?? "Area").slice(0, 60),
        condition: cond(f.condition),
        issues: strArr(f.issues, 8),
      }))
    : [];
  const service = PHOTO_SERVICES.includes(r.recommendedService as PhotoServiceId) ? (r.recommendedService as PhotoServiceId) : "standard-cleaning";
  return {
    findings,
    overallCondition: cond(r.overallCondition),
    recommendedService: service,
    suggestedAddOns: strArr(r.suggestedAddOns, 10).filter((k) => addOnKeys.includes(k)),
    petHairVisible: r.petHairVisible === true,
    supplies: strArr(r.supplies, 12),
    staffNotes: String(r.staffNotes ?? "").slice(0, 600),
    confidence: (["low", "medium", "high"] as const).includes(r.confidence as "low") ? (r.confidence as "low" | "medium" | "high") : "low",
    needsManualReview: r.needsManualReview === true,
  };
}

async function callVision(apiKey: string, input: PhotoEstimateInput, addOns: { key: string; label: string }[]): Promise<PhotoAnalysis | null> {
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const content: unknown[] = [];
  input.images.forEach((img, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img.base64 } });
  });
  content.push({ type: "text", text: buildPrompt(input, addOns) });

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      tools: [buildTool(addOns.map((a) => a.key))],
      tool_choice: { type: "tool", name: "report_cleaning_assessment" },
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`Vision API ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  return sanitizeAnalysis(toolUse?.input, addOns.map((a) => a.key), input.images.length);
}

export interface PhotoEstimateResult {
  mode: "ai" | "fallback";
  analysis: PhotoAnalysis | null;
  service: PhotoServiceId;
  condition: Condition;
  addOns: string[];
  requiresManualQuote: boolean;
  low: number;
  high: number;
  hoursLow: number;
  hoursHigh: number;
  breakdown: { label: string; low: number; high: number }[];
  notice?: string;
}

/**
 * Photos -> structured assessment (model) -> price (our own pricing engine). The model only
 * classifies condition / add-ons / supplies; dollar amounts always come from calculateEstimate
 * with the admin-managed rates, so a model can never invent a price.
 */
export async function runPhotoEstimate(input: PhotoEstimateInput): Promise<PhotoEstimateResult> {
  const config = await getPricingConfig();
  const apiKey = await getIntegrationValue("anthropicApiKey", "ANTHROPIC_API_KEY");
  const addOnDefs = config.addOns.map((a) => ({ key: a.key, label: a.label }));

  let analysis: PhotoAnalysis | null = null;
  let notice: string | undefined;
  if (apiKey) {
    try {
      analysis = await callVision(apiKey, input, addOnDefs);
    } catch {
      notice = "Our photo analysis is unavailable right now, so this estimate uses standard assumptions. We'll review your photos and confirm.";
    }
  } else {
    notice = "Photo analysis isn't switched on yet, so this estimate uses standard assumptions. Your photos still go to our team to review before we confirm a price.";
  }

  const service = input.requestedService ?? analysis?.recommendedService ?? "standard-cleaning";
  const condition = analysis?.overallCondition ?? "normal";
  const addOns = analysis?.suggestedAddOns ?? [];
  const est = calculateEstimate(
    { service, propertyType: input.propertyType, squareFeet: input.squareFeet, bedrooms: input.bedrooms, bathrooms: input.bathrooms, condition, frequency: "one-time", hasPets: input.hasPets || analysis?.petHairVisible === true, addOns },
    config
  );
  const manual = est.requiresManualQuote || analysis?.needsManualReview === true;
  return {
    mode: analysis ? "ai" : "fallback",
    analysis,
    service,
    condition,
    addOns,
    requiresManualQuote: manual,
    low: est.totalLow,
    high: est.totalHigh,
    hoursLow: est.durationHoursLow,
    hoursHigh: est.durationHoursHigh,
    breakdown: est.breakdown,
    notice,
  };
}

export async function savePhotoEstimate(data: {
  customerId?: string;
  imageUrls: string[];
  areaType: string;
  result: PhotoEstimateResult;
}): Promise<string | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const row = await prisma.photoEstimate.create({
    data: {
      customerId: data.customerId ?? null,
      imageUrls: data.imageUrls,
      areaType: data.areaType,
      analysis: JSON.parse(JSON.stringify({ analysis: data.result.analysis, addOns: data.result.addOns, condition: data.result.condition, notice: data.result.notice ?? null })),
      serviceId: data.result.service,
      estimateLow: data.result.requiresManualQuote ? null : data.result.low,
      estimateHigh: data.result.requiresManualQuote ? null : data.result.high,
      hoursLow: data.result.hoursLow,
      hoursHigh: data.result.hoursHigh,
      mode: data.result.mode,
    },
  });
  return row.id;
}

/**
 * Records the customer's own review of the AI assessment — whether they've approved sharing it
 * with the cleaning crew, plus anything they want to add or correct. Only allowed before the
 * estimate has been claimed by a lead (`linkPhotoEstimateToLead` reads this exactly once).
 */
export async function reviewPhotoEstimate(id: string, approved: boolean, customerNotes?: string): Promise<boolean> {
  if (!isDatabaseConfigured || !prisma) return false;
  const pe = await prisma.photoEstimate.findUnique({ where: { id } });
  if (!pe || pe.leadId) return false; // unknown id, or already shared — too late to change
  await prisma.photoEstimate.update({
    where: { id },
    data: { customerApproved: approved, customerNotes: customerNotes?.trim().slice(0, 2000) || null },
  });
  return true;
}

/**
 * When a photo estimate turns into a request, attach the photos to the lead so the team sees
 * them. The AI's structured assessment is only turned into a crew-visible note if the customer
 * reviewed and approved it first (see reviewPhotoEstimate) — never posted blind.
 */
export async function linkPhotoEstimateToLead(photoEstimateId: string, leadId: string, customerId: string): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  const pe = await prisma.photoEstimate.findUnique({ where: { id: photoEstimateId } });
  if (!pe || pe.leadId) return; // unknown id, or already claimed by another lead
  await prisma.photoEstimate.update({ where: { id: pe.id }, data: { leadId, customerId } });
  const urls = Array.isArray(pe.imageUrls) ? (pe.imageUrls as string[]) : [];
  for (const url of urls) {
    await prisma.attachment.create({ data: { customerId, leadId, kind: "IMAGE", url, mimeType: "image/jpeg", caption: "Photo estimate upload", uploadedBy: "CUSTOMER" } });
  }
  const a = (pe.analysis as { analysis?: PhotoAnalysis | null } | null)?.analysis;
  if (a && pe.customerApproved) {
    const lines = [
      `AI photo assessment (${a.confidence} confidence${a.needsManualReview ? ", NEEDS MANUAL REVIEW" : ""}, customer-reviewed): overall ${a.overallCondition}.`,
      ...a.findings.map((f) => `• ${f.area} (${f.condition}): ${f.issues.join("; ") || "no specific issues noted"}`),
      a.supplies.length ? `Bring: ${a.supplies.join(", ")}.` : "",
      a.staffNotes ? `Crew note: ${a.staffNotes}` : "",
      pe.customerNotes ? `Customer note: ${pe.customerNotes}` : "",
    ].filter(Boolean);
    await prisma.clientNote.create({ data: { customerId, leadId, body: lines.join("\n"), author: "STAFF", authorName: "AI photo assessment", kind: "AI_ASSESSMENT" } });
  }
}
