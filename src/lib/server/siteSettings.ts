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
