import { prisma, isDatabaseConfigured } from "@/lib/db";
import { faqs as defaultFaqs } from "@/lib/data/faqs";
import { galleryItems as defaultGalleryItems } from "@/lib/data/gallery";
import { business as defaultBusiness } from "@/lib/data/business";

function requireDb() {
  if (!isDatabaseConfigured || !prisma) {
    throw new Error("Managing this content requires DATABASE_URL to be configured.");
  }
  return prisma;
}

// ---------- FAQs ----------

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export async function listFaqs(activeOnly = false): Promise<FaqItem[]> {
  if (!isDatabaseConfigured || !prisma) {
    return defaultFaqs.map((f, i) => ({ id: `default-${i}`, question: f.question, answer: f.answer, sortOrder: i, isActive: true }));
  }
  const rows = await prisma.faq.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { sortOrder: "asc" },
  });
  return rows;
}

export async function createFaq(data: { question: string; answer: string; sortOrder?: number }) {
  return requireDb().faq.create({ data: { question: data.question, answer: data.answer, sortOrder: data.sortOrder ?? 0 } });
}

export async function updateFaq(id: string, data: Partial<{ question: string; answer: string; sortOrder: number; isActive: boolean }>) {
  return requireDb().faq.update({ where: { id }, data });
}

export async function deleteFaq(id: string) {
  return requireDb().faq.delete({ where: { id } });
}

// ---------- Gallery ----------

export interface GalleryItemContent {
  id: string;
  imageUrl: string;
  altText: string;
  caption: string | null;
  serviceType: string | null;
  category: string | null;
  isPublished: boolean;
  sortOrder: number;
}

export async function listGalleryItems(publishedOnly = false): Promise<GalleryItemContent[]> {
  if (!isDatabaseConfigured || !prisma) {
    return defaultGalleryItems.map((g, i) => ({
      id: g.id,
      imageUrl: g.src,
      altText: g.alt,
      caption: g.caption,
      serviceType: g.serviceType,
      category: g.category,
      isPublished: true,
      sortOrder: i,
    }));
  }
  const rows = await prisma.galleryItem.findMany({
    where: { deletedAt: null, ...(publishedOnly ? { isPublished: true } : {}) },
    orderBy: { sortOrder: "asc" },
  });
  return rows;
}

export async function createGalleryItem(data: { imageUrl: string; altText: string; caption?: string; serviceType?: string; category?: string; sortOrder?: number }) {
  return requireDb().galleryItem.create({ data });
}

export async function updateGalleryItem(
  id: string,
  data: Partial<{ imageUrl: string; altText: string; caption: string; serviceType: string; category: string; isPublished: boolean; sortOrder: number }>
) {
  return requireDb().galleryItem.update({ where: { id }, data });
}

export async function deleteGalleryItem(id: string) {
  return requireDb().galleryItem.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ---------- Service areas ----------

export interface ServiceAreaContent {
  id: string;
  name: string;
  zipCode: string | null;
  isActive: boolean;
}

export async function listServiceAreas(activeOnly = false): Promise<ServiceAreaContent[]> {
  if (!isDatabaseConfigured || !prisma) {
    return defaultBusiness.areaServed.map((name, i) => ({ id: `default-${i}`, name, zipCode: null, isActive: true }));
  }
  return prisma.serviceArea.findMany({ where: activeOnly ? { isActive: true } : undefined, orderBy: { name: "asc" } });
}

export async function createServiceArea(data: { name: string; zipCode?: string }) {
  return requireDb().serviceArea.create({ data });
}

export async function updateServiceArea(id: string, data: Partial<{ name: string; zipCode: string; isActive: boolean }>) {
  return requireDb().serviceArea.update({ where: { id }, data });
}

export async function deleteServiceArea(id: string) {
  return requireDb().serviceArea.delete({ where: { id } });
}
