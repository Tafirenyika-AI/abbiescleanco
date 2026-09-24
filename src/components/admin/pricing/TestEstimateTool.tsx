"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { services, type ServiceId } from "@/lib/data/services";
import { calculateEstimate, conditionLabels, frequencyLabels, type PricingConfig, type Condition, type Frequency, type PropertyType } from "@/lib/pricing";
import Card from "@/components/admin/ui/Card";

export default function TestEstimateTool({ config }: { config: PricingConfig }) {
  const [service, setService] = useState<ServiceId>("standard-cleaning");
  const [propertyType, setPropertyType] = useState<PropertyType>("house");
  const [squareFeet, setSquareFeet] = useState(1500);
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [condition, setCondition] = useState<Condition>("normal");
  const [frequency, setFrequency] = useState<Frequency>("one-time");
  const [hasPets, setHasPets] = useState(false);

  const result = useMemo(
    () => calculateEstimate({ service, propertyType, squareFeet, bedrooms, bathrooms, condition, frequency, hasPets, addOns: [] }, config),
    [service, propertyType, squareFeet, bedrooms, bathrooms, condition, frequency, hasPets, config]
  );

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold text-admin-text"><Calculator className="size-4" aria-hidden /> Test estimate</h2>
      <p className="mt-1 text-sm text-admin-text-muted">
        See how these prices (including any unsaved edits above) would calculate for a sample property.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Service</span>
          <select value={service} onChange={(e) => setService(e.target.value as ServiceId)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Property type</span>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            <option value="house">House</option>
            <option value="apartment">Apartment</option>
            <option value="townhome">Townhome</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Square feet</span>
          <input type="number" min={0} value={squareFeet} onChange={(e) => setSquareFeet(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Condition</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {Object.entries(conditionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Bedrooms</span>
          <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Bathrooms</span>
          <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(Number(e.target.value) || 0)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Frequency</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {Object.entries(frequencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="mt-5 flex items-center gap-2 text-sm text-admin-text">
          <input type="checkbox" checked={hasPets} onChange={(e) => setHasPets(e.target.checked)} /> Has pets
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-admin-bg p-4">
        {result.requiresManualQuote ? (
          <p className="text-sm font-semibold text-admin-text">Requires a manual quote, no automatic price shown to the customer.</p>
        ) : (
          <>
            <p className="text-2xl font-semibold text-admin-text">${result.totalLow} – ${result.totalHigh}</p>
            <p className="mt-1 text-sm text-admin-text-muted">Estimated {result.durationHoursLow}–{result.durationHoursHigh} hours</p>
          </>
        )}
      </div>
    </Card>
  );
}
