import { promises as fs } from "fs";
import path from "path";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { defaultPricingConfig, type PricingConfig } from "@/lib/pricing";
import { services as serviceCatalog } from "@/lib/data/services";

const MOCK_DATA_DIR = path.join(process.cwd(), ".data");
const MOCK_PRICING_FILE = path.join(MOCK_DATA_DIR, "pricing-config.json");

/**
 * Admin-editable pricing, mirroring the DB/mock-fallback pattern used for
 * leads (see leadStore.ts). Without DATABASE_URL, edits from /admin/pricing
 * persist to a local JSON file instead of Postgres — the estimator behaves
 * identically either way.
 */
export async function getPricingConfig(): Promise<PricingConfig> {
  if (isDatabaseConfigured && prisma) {
    const [pricingRules, addons, settings] = await Promise.all([
      prisma.pricingRule.findMany({ where: { isActive: true }, include: { service: true } }),
      prisma.serviceAddon.findMany({ where: { isActive: true } }),
      prisma.businessSetting.findMany({ where: { key: { in: ["recurring_discounts_enabled", "recurring_discount_rates", "condition_multiplier"] } } }),
    ]);

    const config = structuredClone(defaultPricingConfig);

    for (const rule of pricingRules) {
      const slug = rule.service.slug as keyof PricingConfig["services"];
      if (!(slug in config.services)) continue;
      config.services[slug] = {
        baseLow: rule.baseLow,
        baseHigh: rule.baseHigh,
        baseBedrooms: rule.baseBedrooms,
        baseBathrooms: rule.baseBathrooms,
        baseSqFt: rule.baseSqFt,
        perExtraBedroom: rule.perExtraBedroom,
        perExtraBathroom: rule.perExtraBathroom,
        perExtraSqFt: rule.perExtraSqFt,
        manualQuoteAboveSqFt: rule.manualQuoteAboveSqFt,
        // Duration isn't in PricingRule; keep the default hours unless a
        // future migration adds columns for it.
        durationHoursLow: config.services[slug].durationHoursLow,
        durationHoursHigh: config.services[slug].durationHoursHigh,
      };
    }

    if (addons.length > 0) {
      const byKey = new Map(addons.map((a) => [a.key, a]));
      const merged = new Map(config.addOns.map((a) => [a.key, a]));
      for (const [key, addon] of byKey) {
        merged.set(key, { key, label: addon.label, low: addon.priceLow, high: addon.priceHigh });
      }
      config.addOns = [...merged.values()];
    }

    const enabledSetting = settings.find((s) => s.key === "recurring_discounts_enabled");
    if (enabledSetting) config.recurringDiscountsEnabled = Boolean(enabledSetting.value);

    const ratesSetting = settings.find((s) => s.key === "recurring_discount_rates");
    if (ratesSetting && typeof ratesSetting.value === "object" && ratesSetting.value) {
      config.recurringDiscountRates = { ...config.recurringDiscountRates, ...(ratesSetting.value as object) };
    }

    const multiplierSetting = settings.find((s) => s.key === "condition_multiplier");
    if (multiplierSetting && typeof multiplierSetting.value === "object" && multiplierSetting.value) {
      config.conditionMultiplier = { ...config.conditionMultiplier, ...(multiplierSetting.value as object) };
    }

    return config;
  }

  try {
    const raw = await fs.readFile(MOCK_PRICING_FILE, "utf-8");
    const stored = JSON.parse(raw) as PricingConfig;
    // Deep-merge over defaults so a newly-added service in code (with no
    // saved override yet) still gets sane starting numbers.
    return {
      services: { ...defaultPricingConfig.services, ...stored.services },
      addOns: stored.addOns ?? defaultPricingConfig.addOns,
      conditionMultiplier: { ...defaultPricingConfig.conditionMultiplier, ...stored.conditionMultiplier },
      recurringDiscountsEnabled: stored.recurringDiscountsEnabled ?? defaultPricingConfig.recurringDiscountsEnabled,
      recurringDiscountRates: { ...defaultPricingConfig.recurringDiscountRates, ...stored.recurringDiscountRates },
    };
  } catch {
    return structuredClone(defaultPricingConfig);
  }
}

// Add-ons are global in this app (the estimator offers the same list
// regardless of which service is selected — see getPricingConfig(), which
// already reads ServiceAddon rows unfiltered by service). The schema still
// requires each ServiceAddon to belong to a ServiceCatalogItem, so rather
// than replicating every add-on under all 9 services (which previously blew
// up a single admin save into 100+ sequential queries and exceeded the
// pooled connection's transaction timeout), they're anchored to one
// dedicated placeholder service that's never shown anywhere.
const GLOBAL_ADDON_SERVICE_SLUG = "__global_addons__";

export async function savePricingConfig(config: PricingConfig): Promise<void> {
  if (isDatabaseConfigured && prisma) {
    const db = prisma; // narrow once so TS doesn't lose the non-null guard inside closures below
    // Per-service catalog + pricing rule upserts are independent of each
    // other, so run them concurrently instead of one long transaction.
    await Promise.all(
      serviceCatalog.map(async (service) => {
        const rule = config.services[service.id];
        if (!rule) return;

        const catalogItem = await db.serviceCatalogItem.upsert({
          where: { slug: service.id },
          update: {},
          create: { slug: service.id, name: service.name, description: service.shortDescription },
        });

        await db.pricingRule.upsert({
          where: { id: `admin-${service.id}` },
          update: {
            baseLow: rule.baseLow,
            baseHigh: rule.baseHigh,
            baseBedrooms: rule.baseBedrooms,
            baseBathrooms: rule.baseBathrooms,
            baseSqFt: rule.baseSqFt,
            perExtraBedroom: rule.perExtraBedroom,
            perExtraBathroom: rule.perExtraBathroom,
            perExtraSqFt: rule.perExtraSqFt,
            manualQuoteAboveSqFt: rule.manualQuoteAboveSqFt,
            isActive: true,
          },
          create: {
            id: `admin-${service.id}`,
            serviceId: catalogItem.id,
            baseLow: rule.baseLow,
            baseHigh: rule.baseHigh,
            baseBedrooms: rule.baseBedrooms,
            baseBathrooms: rule.baseBathrooms,
            baseSqFt: rule.baseSqFt,
            perExtraBedroom: rule.perExtraBedroom,
            perExtraBathroom: rule.perExtraBathroom,
            perExtraSqFt: rule.perExtraSqFt,
            manualQuoteAboveSqFt: rule.manualQuoteAboveSqFt,
          },
        });
      })
    );

    const globalService = await db.serviceCatalogItem.upsert({
      where: { slug: GLOBAL_ADDON_SERVICE_SLUG },
      update: {},
      create: { slug: GLOBAL_ADDON_SERVICE_SLUG, name: "(internal) global add-ons", description: "", isActive: false },
    });

    const keptKeys = config.addOns.map((a) => a.key);
    await Promise.all([
      db.serviceAddon.updateMany({
        where: { serviceId: globalService.id, key: { notIn: keptKeys } },
        data: { isActive: false },
      }),
      ...config.addOns.map((addOn) =>
        db.serviceAddon.upsert({
          where: { serviceId_key: { serviceId: globalService.id, key: addOn.key } },
          update: { label: addOn.label, priceLow: addOn.low, priceHigh: addOn.high, isActive: true },
          create: { serviceId: globalService.id, key: addOn.key, label: addOn.label, priceLow: addOn.low, priceHigh: addOn.high },
        })
      ),
      db.businessSetting.upsert({
        where: { key: "recurring_discounts_enabled" },
        update: { value: config.recurringDiscountsEnabled },
        create: { key: "recurring_discounts_enabled", value: config.recurringDiscountsEnabled },
      }),
      db.businessSetting.upsert({
        where: { key: "recurring_discount_rates" },
        update: { value: config.recurringDiscountRates },
        create: { key: "recurring_discount_rates", value: config.recurringDiscountRates },
      }),
      db.businessSetting.upsert({
        where: { key: "condition_multiplier" },
        update: { value: config.conditionMultiplier },
        create: { key: "condition_multiplier", value: config.conditionMultiplier },
      }),
    ]);
    return;
  }

  await fs.mkdir(MOCK_DATA_DIR, { recursive: true });
  await fs.writeFile(MOCK_PRICING_FILE, JSON.stringify(config, null, 2), "utf-8");
}
