/**
 * Safe demonstration seed data — no real customer information.
 * Run with `npm run db:seed` once DATABASE_URL points at a real Postgres/Supabase database.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { services } from "../src/lib/data/services";
import { defaultPricingConfig } from "../src/lib/pricing";
import { savePricingConfig } from "../src/lib/server/pricingStore";
import { testimonials } from "../src/lib/data/testimonials";
import { faqs } from "../src/lib/data/faqs";
import { business } from "../src/lib/data/business";
import { ALL_ADMIN_PERMISSIONS } from "../src/lib/permissions";

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

  console.log("Seeding published reviews (genuine testimonials carried over from the live site)...");
  for (const t of testimonials) {
    await prisma.review.upsert({
      where: { id: `seed-${t.id}` },
      update: { authorName: t.name, location: t.location, quote: t.quote, rating: 5, isPublished: true, isFeatured: true, source: "direct" },
      create: {
        id: `seed-${t.id}`,
        authorName: t.name,
        location: t.location,
        quote: t.quote,
        rating: 5,
        isPublished: true,
        isFeatured: true,
        source: "direct",
      },
    });
  }

  console.log("Seeding FAQs...");
  for (const [index, faq] of faqs.entries()) {
    await prisma.faq.upsert({
      where: { id: `seed-faq-${index}` },
      update: { question: faq.question, answer: faq.answer, sortOrder: index, isActive: true },
      create: { id: `seed-faq-${index}`, question: faq.question, answer: faq.answer, sortOrder: index, isActive: true },
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

  const demoEmail = process.env.ADMIN_DEMO_EMAIL;
  const demoPassword = process.env.ADMIN_DEMO_PASSWORD;
  if (demoEmail && demoPassword) {
    console.log("Seeding a real admin_users row from ADMIN_DEMO_EMAIL/PASSWORD (full permissions)...");
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    await prisma.adminUser.upsert({
      where: { email: demoEmail.toLowerCase() },
      update: { passwordHash, permissions: [...ALL_ADMIN_PERMISSIONS], isActive: true },
      create: {
        email: demoEmail.toLowerCase(),
        name: "Owner",
        passwordHash,
        role: "Owner",
        permissions: [...ALL_ADMIN_PERMISSIONS],
      },
    });
  } else {
    console.log("ADMIN_DEMO_EMAIL/PASSWORD not set — skipping admin_users seed. The app falls back to");
    console.log("mock-mode demo login until DATABASE_URL AND at least one admin_users row exist together.");
  }

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
