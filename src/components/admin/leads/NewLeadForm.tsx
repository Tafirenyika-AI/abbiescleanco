"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { conditionLabels, frequencyLabels } from "@/lib/pricing";
import { services } from "@/lib/data/services";

export default function NewLeadForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState<string>(services[0]?.id ?? "");
  const [zip, setZip] = useState("");
  const [propertyType, setPropertyType] = useState<"house" | "apartment" | "townhome" | "commercial">("house");
  const [squareFeet, setSquareFeet] = useState("1500");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("2");
  const [condition, setCondition] = useState<keyof typeof conditionLabels>("normal");
  const [frequency, setFrequency] = useState<keyof typeof frequencyLabels>("one-time");
  const [hasPets, setHasPets] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName, lastName, email, phone, service, zip, propertyType,
        squareFeet: Number(squareFeet), bedrooms: Number(bedrooms), bathrooms: Number(bathrooms),
        condition, frequency, hasPets, additionalInstructions: additionalInstructions || undefined,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) {
      setError(json.error || "Couldn't create lead");
      return;
    }
    router.push("/admin/leads");
  }

  const valid = firstName.trim() && lastName.trim() && email.trim() && phone.trim() && /^\d{5}(-\d{4})?$/.test(zip.trim());

  return (
    <Card className="max-w-2xl">
      <h2 className="font-semibold text-admin-text">Contact</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">First name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Last name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Phone</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
      </div>

      <h2 className="mt-5 font-semibold text-admin-text">Property & service</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="text-xs font-medium text-admin-text-muted">Service</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">ZIP code</span>
          <input value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Property type</span>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as typeof propertyType)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            <option value="house">House</option>
            <option value="apartment">Apartment</option>
            <option value="townhome">Townhome</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Square feet</span>
          <input type="number" min="100" value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Bedrooms</span>
          <input type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Bathrooms</span>
          <input type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Condition</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {Object.entries(conditionLabels).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Frequency</span>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {Object.entries(frequencyLabels).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </label>
        <label className="mt-6 flex items-center gap-2">
          <input type="checkbox" checked={hasPets} onChange={(e) => setHasPets(e.target.checked)} />
          <span className="text-sm text-admin-text">Has pets</span>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-admin-text-muted">Notes (optional)</span>
        <textarea value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
      </label>

      {error && <p className="mt-3 text-sm text-admin-error">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!valid || saving}
        className="ios-press mt-4 flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Create lead
      </button>
    </Card>
  );
}
