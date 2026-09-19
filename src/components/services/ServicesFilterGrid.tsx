"use client";

import { useMemo, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import ServiceCard from "@/components/services/ServiceCard";
import type { Service } from "@/lib/data/services";
import { getServicePriceLabel, type PricingConfig } from "@/lib/pricing";

const tabs: { key: Service["category"] | "all"; label: string }[] = [
  { key: "all", label: "All services" },
  { key: "home", label: "Home" },
  { key: "specialty", label: "Specialty" },
  { key: "commercial", label: "Commercial" },
];

export default function ServicesFilterGrid({ services, pricingConfig }: { services: Service[]; pricingConfig?: PricingConfig }) {
  const [active, setActive] = useState<(typeof tabs)[number]["key"]>("all");

  const filtered = useMemo(
    () => (active === "all" ? services : services.filter((s) => s.category === active)),
    [active, services]
  );

  return (
    <div>
      <div className="ios-segment" role="tablist" aria-label="Filter services by category">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className="ios-segment-item"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((service, i) => (
          <Reveal key={service.id} delayMs={(i % 3) * 80}>
            <ServiceCard service={service} priceLabel={pricingConfig ? getServicePriceLabel(service.id, pricingConfig) : undefined} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
