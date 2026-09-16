import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { services as defaultServices, type Service, type ServiceId } from "@/lib/data/services";

export interface ServiceContent extends Service {
  isActive: boolean;
  sortOrder: number;
}

interface ServiceDetails {
  forWho?: string;
  included?: string[];
  addOns?: string[];
  recommendedFrequency?: string;
  prepare?: string[];
}

function defaultsFor(s: Service, index: number): ServiceContent {
  return { ...s, isActive: true, sortOrder: index };
}

/** Merges admin edits (DB) over the real starting content (services.ts) — same pattern as pricing. */
export async function getServicesContent(): Promise<ServiceContent[]> {
  const base = defaultServices.map(defaultsFor);

  if (!isDatabaseConfigured || !prisma) {
    return base;
  }

  const rows = await prisma.serviceCatalogItem.findMany({ where: { deletedAt: null } });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const merged = base.map((s) => {
    const row = bySlug.get(s.id);
    if (!row) return s;
    const details = (row.details as ServiceDetails | null) ?? {};
    return {
      ...s,
      name: row.name || s.name,
      shortDescription: row.description || s.shortDescription,
      category: (row.category as Service["category"]) || s.category,
      image: row.imageUrl || s.image,
      imageAlt: row.imageAlt || s.imageAlt,
      forWho: details.forWho ?? s.forWho,
      included: details.included ?? s.included,
      addOns: details.addOns ?? s.addOns,
      recommendedFrequency: details.recommendedFrequency ?? s.recommendedFrequency,
      prepare: details.prepare ?? s.prepare,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  });

  return merged.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getServiceContentById(id: ServiceId): Promise<ServiceContent | null> {
  const all = await getServicesContent();
  return all.find((s) => s.id === id) ?? null;
}

export async function updateServiceContent(
  id: ServiceId,
  data: Partial<Pick<ServiceContent, "name" | "shortDescription" | "category" | "image" | "imageAlt" | "forWho" | "included" | "addOns" | "recommendedFrequency" | "prepare" | "isActive">>
): Promise<void> {
  if (!isDatabaseConfigured || !prisma) {
    throw new Error("Editing service content requires DATABASE_URL to be configured.");
  }

  const fallback = defaultServices.find((s) => s.id === id);
  const existing = await prisma.serviceCatalogItem.findUnique({ where: { slug: id } });
  const existingDetails = (existing?.details as ServiceDetails | null) ?? {};
  const details: ServiceDetails = {
    forWho: data.forWho ?? existingDetails.forWho,
    included: data.included ?? existingDetails.included,
    addOns: data.addOns ?? existingDetails.addOns,
    recommendedFrequency: data.recommendedFrequency ?? existingDetails.recommendedFrequency,
    prepare: data.prepare ?? existingDetails.prepare,
  };

  await prisma.serviceCatalogItem.upsert({
    where: { slug: id },
    update: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.shortDescription !== undefined ? { description: data.shortDescription } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.image !== undefined ? { imageUrl: data.image } : {}),
      ...(data.imageAlt !== undefined ? { imageAlt: data.imageAlt } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      details: details as Prisma.InputJsonValue,
    },
    create: {
      slug: id,
      name: data.name || fallback?.name || id,
      description: data.shortDescription || fallback?.shortDescription || "",
      category: data.category || fallback?.category || "home",
      imageUrl: data.image || fallback?.image,
      imageAlt: data.imageAlt || fallback?.imageAlt,
      isActive: data.isActive ?? true,
      details: details as Prisma.InputJsonValue,
    },
  });
}
