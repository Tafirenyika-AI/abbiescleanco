/**
 * Safe demonstration seed data — no real customer information.
 * Run with `npm run db:seed` once DATABASE_URL points at a real Postgres/Supabase database.
 */
import { PrismaClient } from "@prisma/client";
import { services } from "../src/lib/data/services";
import { servicePricing, addOnPricing } from "../src/lib/pricing";
import { testimonials } from "../src/lib/data/testimonials";
import { business } from "../src/lib/data/business";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding services, pricing rules, and add-ons...");
  for (const service of services) {
    const created = await prisma.serviceCatalogItem.upsert({
      where: { slug: service.id },
      update: { name: service.name, description: service.shortDescription },
      create: { slug: service.id, name: service.name, description: service.shortDescription },
    });

    const pricing = servicePricing[service.id];
    if (pricing.baseLow > 0 || pricing.baseHigh > 0) {
      await prisma.pricingRule.upsert({
        where: { id: `seed-${service.id}` },
        update: {
          baseLow: pricing.baseLow,
          baseHigh: pricing.baseHigh,
          baseBedrooms: pricing.baseBedrooms,
          baseBathrooms: pricing.baseBathrooms,
          baseSqFt: pricing.baseSqFt,
          perExtraBedroom: pricing.perExtraBedroom,
          perExtraBathroom: pricing.perExtraBathroom,
          perExtraSqFt: pricing.perExtraSqFt,
          manualQuoteAboveSqFt: pricing.manualQuoteAboveSqFt,
        },
        create: {
          id: `seed-${service.id}`,
          serviceId: created.id,
          baseLow: pricing.baseLow,
          baseHigh: pricing.baseHigh,
          baseBedrooms: pricing.baseBedrooms,
          baseBathrooms: pricing.baseBathrooms,
          baseSqFt: pricing.baseSqFt,
          perExtraBedroom: pricing.perExtraBedroom,
          perExtraBathroom: pricing.perExtraBathroom,
          perExtraSqFt: pricing.perExtraSqFt,
          manualQuoteAboveSqFt: pricing.manualQuoteAboveSqFt,
        },
      });
    }

    for (const [key, addOn] of Object.entries(addOnPricing)) {
      await prisma.serviceAddon.upsert({
        where: { serviceId_key: { serviceId: created.id, key } },
        update: { label: addOn.label, priceLow: addOn.low, priceHigh: addOn.high },
        create: { serviceId: created.id, key, label: addOn.label, priceLow: addOn.low, priceHigh: addOn.high },
      });
    }
  }

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
  await prisma.businessSetting.upsert({
    where: { key: "recurring_discounts_enabled" },
    update: { value: false },
    create: { key: "recurring_discounts_enabled", value: false },
  });

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
