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
