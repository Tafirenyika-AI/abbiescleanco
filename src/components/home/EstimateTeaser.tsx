"use client";

import { useMemo, useState } from "react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { calculateEstimate, defaultPricingConfig, type Condition, type PricingConfig } from "@/lib/pricing";
import { services as defaultServices, type ServiceId } from "@/lib/data/services";

interface SelectableService {
  id: ServiceId;
  name: string;
  category: string;
  isActive?: boolean;
}

export default function EstimateTeaser({
  pricingConfig = defaultPricingConfig,
  services = defaultServices,
}: {
  pricingConfig?: PricingConfig;
  services?: SelectableService[];
}) {
  const quickServices = services.filter((s) => s.category !== "commercial" && s.isActive !== false);
  const [serviceId, setServiceId] = useState<ServiceId>("standard-cleaning");
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [condition] = useState<Condition>("normal");

  const estimate = useMemo(
    () =>
      calculateEstimate(
        {
          service: serviceId,
          propertyType: "house",
          squareFeet: 1500,
          bedrooms,
          bathrooms,
          condition,
          frequency: "one-time",
          hasPets: false,
          addOns: [],
        },
        pricingConfig
      ),
    [serviceId, bedrooms, bathrooms, condition, pricingConfig]
  );

  const params = new URLSearchParams({
    service: serviceId,
    bedrooms: String(bedrooms),
    bathrooms: String(bathrooms),
  });

  return (
    <Section ariaLabelledby="estimate-teaser-heading">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Instant estimate</Eyebrow>
          <h2 id="estimate-teaser-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
            See a preliminary range in seconds
          </h2>
          <p className="mt-3 max-w-md text-surface-700">
            Try it right here — pick a service and your home&apos;s size for a quick, preliminary
            range. Continue to the full estimate to get your exact quote reference and add-ons.
          </p>
          <p className="mt-3 text-sm text-surface-700">
            This is a preliminary estimate only. Final pricing is confirmed after we review your
            property&apos;s details.
          </p>
        </div>

        <div className="glass-card rounded-3xl border border-surface-200 bg-surface-50 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-5">
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Service</span>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value as ServiceId)}
                className="mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm text-navy-950"
              >
                {quickServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-navy-900">Bedrooms</span>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm text-navy-950"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-navy-900">Bathrooms</span>
                <select
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm text-navy-950"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="estimate-highlight mt-6 rounded-2xl bg-navy-950 p-5 text-center text-white">
            <p className="text-xs uppercase tracking-wide text-teal-300">Preliminary estimate</p>
            {estimate.requiresManualQuote ? (
              <p className="mt-1 text-xl font-semibold">Manual quote required</p>
            ) : (
              <p className="mt-1 text-3xl font-semibold">
                ${estimate.low}–${estimate.high}
              </p>
            )}
          </div>

          <Button href={`/estimate?${params.toString()}`} size="lg" className="mt-6 w-full">
            Get my full estimate
          </Button>
        </div>
      </div>
    </Section>
  );
}
