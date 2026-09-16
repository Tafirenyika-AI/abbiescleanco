/**
 * Safe demonstration seed data — no real customer information.
 * Run with `npm run db:seed` once DATABASE_URL points at a real Postgres/Supabase database.
 */
import { PrismaClient } from "@prisma/client";
import { services } from "../src/lib/data/services";
import { defaultPricingConfig } from "../src/lib/pricing";
import { savePricingConfig } from "../src/lib/server/pricingStore";
import { testimonials } from "../src/lib/data/testimonials";
import { business } from "../src/lib/data/business";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding service catalog...");
  for (const service of services) {
    await prisma.serviceCatalogItem.upsert({
      where: { slug: service.id },
      update: { name: service.name, description: service.shortDescription },
      create: { slug: service.id, name: service.name, description: service.shortDescription },
    });
  }

  console.log("Seeding pricing rules and add-ons (via the same path /admin/pricing writes to)...");
  await savePricingConfig(defaultPricingConfig);

  console.log("Seeding service areas...");
  for (const area of business.areaServed) {
    await prisma.serviceArea.upsert({
      where: { id: `seed-${area.toLowerCase().replace(/\s+/g, "-")}` },
      update: { name: area, isActive: true },
      create: { id: `seed-${area.toLowerCase().replace(/\s+/g, "-")}`, name: area, isActive: true },
    });
  }

  console.log("Seeding published reviews...");
  for (const t of testimonials) {
    await prisma.review.upsert({
      where: { id: `seed-${t.id}` },
      update: { authorName: t.name, location: t.location, quote: t.quote, isPublished: true, source: "direct" },
      create: {
        id: `seed-${t.id}`,
        authorName: t.name,
        location: t.location,
        quote: t.quote,
        isPublished: true,
        source: "direct",
      },
    });
  }

  console.log("Seeding business settings...");
  await prisma.businessSetting.upsert({
    where: { key: "business_hours" },
    update: { value: business.hours },
    create: { key: "business_hours", value: business.hours },
  });
  // recurring_discounts_enabled, recurring_discount_rates, and
  // condition_multiplier are already written by savePricingConfig() above.

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
