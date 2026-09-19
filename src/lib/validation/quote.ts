import { z } from "zod";

export const serviceIds = [
  "standard-cleaning",
  "deep-cleaning",
  "move-in-cleaning",
  "move-out-cleaning",
  "bathroom-deep-cleaning",
  "kitchen-deep-cleaning",
  "laundry-organization",
  "residential-cleaning",
  "commercial-cleaning",
] as const;

export const quoteRequestSchema = z.object({
  // Property
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid 5-digit ZIP code"),
  propertyType: z.enum(["apartment", "house", "townhome", "commercial"]),
  squareFeet: z.coerce.number().int().min(100, "Enter an approximate square footage").max(20000),
  bedrooms: z.coerce.number().int().min(0).max(15),
  bathrooms: z.coerce.number().int().min(0).max(15),

  // Service
  service: z.enum(serviceIds),
  frequency: z.enum(["one-time", "weekly", "biweekly", "every-4-weeks", "custom"]),
  condition: z.enum(["light", "normal", "heavy", "very-heavy"]),
  hasPets: z.boolean().default(false),
  lastProfessionalCleaning: z.string().trim().max(100).optional().or(z.literal("")),
  preferredDate: z.string().trim().optional().or(z.literal("")),
  // Add-on keys are admin-managed (see /admin/pricing), not a fixed enum —
  // validated loosely here; unknown/removed keys are simply ignored when the
  // estimate is calculated (see calculateEstimate in lib/pricing.ts).
  addOns: z.array(z.string().trim().min(1).max(60)).max(20).default([]),

  // Contact
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s()+-]{7,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email address"),
  preferredContactMethod: z.enum(["PHONE", "EMAIL", "WHATSAPP", "SMS"]),
  additionalInstructions: z.string().trim().max(2000).optional().or(z.literal("")),

  // Consent & anti-spam
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(true),
  policiesAccepted: z.literal(true, {
    error: "Please accept the service policies to continue",
  }),
  // Honeypot field — real users never see or fill this input. Named to avoid
  // any autofill-recognizable pattern (a field literally named "companyWebsite"
  // got silently filled by browser/password-manager autofill for a real user,
  // even while visually hidden, since autofill keys off the field name/type
  // rather than visibility). Deliberately NOT constrained to empty here: the
  // route handler checks it after parsing so a filled value can get a
  // normal-looking 200 response instead of a validation-error 400 that would
  // tip off a bot that it's being screened.
  _gotcha: z.string().max(200).optional().or(z.literal("")),
  // Attribution
  source: z.string().trim().max(50).optional(),
  campaign: z.string().trim().max(100).optional(),

  // Optional promo code, validated server-side when the quote is built (not at submit time)
  promoCode: z.string().trim().max(30).optional().or(z.literal("")),

  // Set when this request started from the photo estimator; links the photos + assessment to the lead.
  photoEstimateId: z.string().trim().max(40).optional(),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
/** Pre-coercion shape used to type the React Hook Form instance (numeric fields arrive as raw input before zodResolver parses them). */
export type QuoteRequestFormValues = z.input<typeof quoteRequestSchema>;
