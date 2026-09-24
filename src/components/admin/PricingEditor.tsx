"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { services, type ServiceId } from "@/lib/data/services";
import { pricingConfigSchema } from "@/lib/validation/pricingConfig";
import type { PricingConfig, ServicePricing, Condition, Frequency } from "@/lib/pricing";
import { conditionLabels, frequencyLabels } from "@/lib/pricing";
import Button from "@/components/ui/Button";
import TestEstimateTool from "@/components/admin/pricing/TestEstimateTool";

const serviceFieldMeta: { key: keyof ServicePricing; label: string; hint?: string; step?: string }[] = [
  { key: "baseLow", label: "Base price: low ($)" },
  { key: "baseHigh", label: "Base price: high ($)" },
  { key: "baseBedrooms", label: "Base bedrooms", hint: "Bedroom count the base price assumes" },
  { key: "baseBathrooms", label: "Base bathrooms" },
  { key: "baseSqFt", label: "Base sq ft" },
  { key: "perExtraBedroom", label: "$ per extra bedroom" },
  { key: "perExtraBathroom", label: "$ per extra bathroom" },
  { key: "perExtraSqFt", label: "$ per extra sq ft", step: "0.01" },
  { key: "manualQuoteAboveSqFt", label: "Manual quote above (sq ft)", hint: "0 = always manual quote" },
  { key: "durationHoursLow", label: "Duration: low (hrs)" },
  { key: "durationHoursHigh", label: "Duration: high (hrs)" },
];

type SaveState = { status: "idle" } | { status: "saving" } | { status: "success" } | { status: "error"; message: string };

export default function PricingEditor({ initialConfig }: { initialConfig: PricingConfig }) {
  const [config, setConfig] = useState<PricingConfig>(initialConfig);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const servicesWithPricing = useMemo(
    () => services.filter((s) => s.id !== "commercial-cleaning" || config.services[s.id].baseLow > 0),
    [config.services]
  );

  function updateService(serviceId: ServiceId, field: keyof ServicePricing, value: number) {
    setConfig((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceId]: { ...prev.services[serviceId], [field]: value },
      },
    }));
  }

  function updateAddOn(index: number, field: "key" | "label" | "low" | "high", value: string | number) {
    setConfig((prev) => {
      const addOns = [...prev.addOns];
      addOns[index] = { ...addOns[index], [field]: value };
      return { ...prev, addOns };
    });
  }

  function addAddOn() {
    setConfig((prev) => ({
      ...prev,
      addOns: [...prev.addOns, { key: `new-addon-${prev.addOns.length + 1}`, label: "New add-on", low: 0, high: 0 }],
    }));
  }

  function removeAddOn(index: number) {
    setConfig((prev) => ({ ...prev, addOns: prev.addOns.filter((_, i) => i !== index) }));
  }

  function updateConditionMultiplier(condition: Condition, value: number) {
    setConfig((prev) => ({ ...prev, conditionMultiplier: { ...prev.conditionMultiplier, [condition]: value } }));
  }

  function updateDiscountRate(frequency: Frequency, percent: number) {
    setConfig((prev) => ({
      ...prev,
      recurringDiscountRates: { ...prev.recurringDiscountRates, [frequency]: percent / 100 },
    }));
  }

  async function handleSave() {
    const parsed = pricingConfigSchema.safeParse(config);
    if (!parsed.success) {
      setFieldErrors(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      setSaveState({ status: "error", message: "Fix the highlighted issues before saving." });
      return;
    }
    setFieldErrors([]);
    setSaveState({ status: "saving" });
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setSaveState({ status: "error", message: json.error || "Save failed." });
        return;
      }
      setSaveState({ status: "success" });
    } catch {
      setSaveState({ status: "error", message: "Network error. Please try again." });
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-admin-text">Service pricing</h2>
        <div className="mt-4 space-y-3">
          {servicesWithPricing.map((service) => {
            const pricing = config.services[service.id];
            return (
              <details key={service.id} className="rounded-2xl border border-admin-border bg-admin-card p-4 open:pb-5">
                <summary className="cursor-pointer list-none">
                  <span className="flex items-center justify-between">
                    <span className="font-semibold text-admin-text">{service.name}</span>
                    <span className="text-sm text-admin-text-muted">
                      ${pricing.baseLow}–${pricing.baseHigh}
                    </span>
                  </span>
                </summary>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {serviceFieldMeta.map((field) => (
                    <label key={field.key} className="block">
                      <span className="text-xs font-medium text-admin-text-muted">{field.label}</span>
                      <input
                        type="number"
                        step={field.step ?? "1"}
                        min={0}
                        value={pricing[field.key]}
                        onChange={(e) => updateService(service.id, field.key, Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
                      />
                      {field.hint && <span className="mt-0.5 block text-[11px] text-admin-text-muted">{field.hint}</span>}
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-admin-text">Add-ons</h2>
          <Button type="button" variant="outline" size="md" onClick={addAddOn}>
            <Plus className="size-4" aria-hidden /> Add new
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {config.addOns.map((addOn, index) => (
            <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-admin-border p-3">
              <label className="col-span-4">
                <span className="text-xs font-medium text-admin-text-muted">Label</span>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
                  value={addOn.label}
                  onChange={(e) => updateAddOn(index, "label", e.target.value)}
                />
              </label>
              <label className="col-span-3">
                <span className="text-xs font-medium text-admin-text-muted">Key</span>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm font-mono"
                  value={addOn.key}
                  onChange={(e) => updateAddOn(index, "key", e.target.value)}
                />
              </label>
              <label className="col-span-2">
                <span className="text-xs font-medium text-admin-text-muted">Low ($)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
                  value={addOn.low}
                  onChange={(e) => updateAddOn(index, "low", Number(e.target.value))}
                />
              </label>
              <label className="col-span-2">
                <span className="text-xs font-medium text-admin-text-muted">High ($)</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
                  value={addOn.high}
                  onChange={(e) => updateAddOn(index, "high", Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={() => removeAddOn(index)}
                aria-label={`Remove ${addOn.label}`}
                className="col-span-1 flex h-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          {config.addOns.length === 0 && <p className="text-sm text-admin-text-muted">No add-ons configured.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-admin-text">Condition multipliers</h2>
        <p className="mt-1 text-sm text-admin-text-muted">Applied to the base price based on the property&apos;s reported condition.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(conditionLabels) as Condition[]).map((condition) => (
            <label key={condition} className="block">
              <span className="text-xs font-medium text-admin-text-muted">{conditionLabels[condition]}</span>
              <input
                type="number"
                step="0.01"
                min={0}
                max={5}
                value={config.conditionMultiplier[condition]}
                onChange={(e) => updateConditionMultiplier(condition, Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-admin-text">Recurring-service discounts</h2>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={config.recurringDiscountsEnabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, recurringDiscountsEnabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>
        <p className="mt-1 text-sm text-admin-text-muted">
          Off by default, savings language only appears on the site once this is enabled.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(frequencyLabels) as Frequency[]).map((frequency) => (
            <label key={frequency} className="block">
              <span className="text-xs font-medium text-admin-text-muted">{frequencyLabels[frequency]}</span>
              <div className="mt-1 flex items-center rounded-lg border border-admin-border px-2.5 py-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(config.recurringDiscountRates[frequency] * 100)}
                  onChange={(e) => updateDiscountRate(frequency, Number(e.target.value))}
                  className="w-full text-sm outline-none"
                />
                <span className="text-sm text-admin-text-muted">%</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <TestEstimateTool config={config} />

      {fieldErrors.length > 0 && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <ul className="list-disc space-y-1 pl-5">
            {fieldErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-admin-border pt-6">
        <Button type="button" size="lg" onClick={handleSave} disabled={saveState.status === "saving"}>
          {saveState.status === "saving" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        {saveState.status === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-admin-teal-hover">
            <CheckCircle2 className="size-4" aria-hidden /> Saved, live on the site now.
          </span>
        )}
        {saveState.status === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-700">
            <AlertCircle className="size-4" aria-hidden /> {saveState.message}
          </span>
        )}
      </div>
    </div>
  );
}
