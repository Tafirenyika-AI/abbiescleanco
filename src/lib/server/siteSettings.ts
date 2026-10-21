import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { business as defaultBusiness } from "@/lib/data/business";

export interface BusinessHoursRow {
  days: string;
  time: string;
}

export interface SocialLinks {
  facebook?: string;
  tiktok?: string;
  // The business's real, public Google Business Profile listing URL (e.g. https://g.page/...
  // or a Google Maps place link). Linking the website and the GBP listing to each other is a
  // real, zero-cost local-SEO signal Google's own guidance recommends -- this app doesn't have
  // a live GBP API connection, so this is a manually-entered link, not something fetched.
  googleBusinessUrl?: string;
}

export async function getBusinessHours(): Promise<BusinessHoursRow[]> {
  if (!isDatabaseConfigured || !prisma) return [...defaultBusiness.hours];
  const row = await prisma.businessSetting.findUnique({ where: { key: "business_hours" } });
  return (row?.value as BusinessHoursRow[] | undefined) ?? [...defaultBusiness.hours];
}

export async function setBusinessHours(hours: BusinessHoursRow[]): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  await prisma.businessSetting.upsert({
    where: { key: "business_hours" },
    update: { value: hours as unknown as Prisma.InputJsonValue },
    create: { key: "business_hours", value: hours as unknown as Prisma.InputJsonValue },
  });
}

export async function getSocialLinks(): Promise<SocialLinks> {
  if (!isDatabaseConfigured || !prisma) return { ...defaultBusiness.social };
  const row = await prisma.businessSetting.findUnique({ where: { key: "social_links" } });
  return (row?.value as SocialLinks | undefined) ?? { ...defaultBusiness.social };
}

export async function setSocialLinks(links: SocialLinks): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  await prisma.businessSetting.upsert({
    where: { key: "social_links" },
    update: { value: links as Prisma.InputJsonValue },
    create: { key: "social_links", value: links as Prisma.InputJsonValue },
  });
}

export interface ContactInfo {
  phoneDisplay: string;
  phoneE164: string;
  whatsappE164: string;
  email: string;
}

const defaultContactInfo: ContactInfo = {
  phoneDisplay: defaultBusiness.phoneDisplay,
  phoneE164: defaultBusiness.phoneE164,
  whatsappE164: defaultBusiness.whatsappE164,
  email: defaultBusiness.email,
};

/** The real phone/WhatsApp/email used site-wide (footer, header, contact page, emails, the guest assistant). Editing this in /admin/settings changes every one of those the next time each page renders -- no code redeploy needed. */
export async function getContactInfo(): Promise<ContactInfo> {
  if (!isDatabaseConfigured || !prisma) return { ...defaultContactInfo };
  const row = await prisma.businessSetting.findUnique({ where: { key: "contact_info" } });
  return { ...defaultContactInfo, ...(row?.value as Partial<ContactInfo> | undefined) };
}

export async function setContactInfo(info: ContactInfo): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  await prisma.businessSetting.upsert({
    where: { key: "contact_info" },
    update: { value: info as unknown as Prisma.InputJsonValue },
    create: { key: "contact_info", value: info as unknown as Prisma.InputJsonValue },
  });
}

export interface BrandingSettings {
  logoUrl: string | null;
}

const defaultBranding: BrandingSettings = { logoUrl: null };

/** logoUrl null means "use the static /images/logo.png shipped with the site". */
export async function getBranding(): Promise<BrandingSettings> {
  if (!isDatabaseConfigured || !prisma) return { ...defaultBranding };
  const row = await prisma.businessSetting.findUnique({ where: { key: "branding" } });
  return { ...defaultBranding, ...(row?.value as Partial<BrandingSettings> | undefined) };
}

export async function setBranding(branding: BrandingSettings): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  await prisma.businessSetting.upsert({
    where: { key: "branding" },
    update: { value: branding as unknown as Prisma.InputJsonValue },
    create: { key: "branding", value: branding as unknown as Prisma.InputJsonValue },
  });
}

export interface EmailSignatureSettings {
  founderFirstName: string;
  founderLastName: string;
  founderTitle: string;
  tagline: string;
  // When set, this real designed signature graphic is attached exactly as-is instead of the
  // HTML-recreated block built from the fields above (which only act as a fallback once this is
  // cleared). Uploaded the same way as the branding logo -- see ImageUploadField.
  imageUrl: string | null;
}

const defaultEmailSignature: EmailSignatureSettings = {
  founderFirstName: defaultBusiness.founder.firstName,
  founderLastName: defaultBusiness.founder.lastName,
  founderTitle: defaultBusiness.founder.title,
  tagline: defaultBusiness.emailSignatureTagline,
  imageUrl: null,
};

/** The branded signature appended to prospecting outreach emails -- either a real uploaded
 *  signature image (imageUrl) attached as-is, or an HTML-recreated fallback built from the other
 *  fields when no image has been uploaded. Phone/email come from getContactInfo() instead, so
 *  they only need editing in one place. */
export async function getEmailSignatureSettings(): Promise<EmailSignatureSettings> {
  if (!isDatabaseConfigured || !prisma) return { ...defaultEmailSignature };
  const row = await prisma.businessSetting.findUnique({ where: { key: "email_signature" } });
  return { ...defaultEmailSignature, ...(row?.value as Partial<EmailSignatureSettings> | undefined) };
}

export async function setEmailSignatureSettings(signature: EmailSignatureSettings): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  await prisma.businessSetting.upsert({
    where: { key: "email_signature" },
    update: { value: signature as unknown as Prisma.InputJsonValue },
    create: { key: "email_signature", value: signature as unknown as Prisma.InputJsonValue },
  });
}
