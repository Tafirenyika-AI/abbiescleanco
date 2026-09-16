"use client";

import { useMemo, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import ServiceCard from "@/components/services/ServiceCard";
import type { Service } from "@/lib/data/services";

const tabs: { key: Service["category"] | "all"; label: string }[] = [
  { key: "all", label: "All services" },
  { key: "home", label: "Home" },
  { key: "specialty", label: "Specialty" },
  { key: "commercial", label: "Commercial" },
];

export default function ServicesFilterGrid({ services }: { services: Service[] }) {
  const [active, setActive] = useState<(typeof tabs)[number]["key"]>("all");

  const filtered = useMemo(
    () => (active === "all" ? services : services.filter((s) => s.category === active)),
    [active, services]
  );

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-surface-200 bg-surface-50 p-1" role="tablist" aria-label="Filter services by category">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active === tab.key ? "bg-navy-950 text-white shadow-sm" : "text-navy-700 hover:text-navy-950"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((service, i) => (
          <Reveal key={service.id} delayMs={(i % 3) * 80}>
            <ServiceCard service={service} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
