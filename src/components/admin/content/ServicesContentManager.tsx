"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { ServiceContent } from "@/lib/server/servicesContent";

function toLines(arr: string[]) {
  return arr.join("\n");
}
function fromLines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function ServiceRow({ service }: { service: ServiceContent }) {
  const [form, setForm] = useState({
    name: service.name,
    shortDescription: service.shortDescription,
    category: service.category,
    image: service.image,
    imageAlt: service.imageAlt,
    forWho: service.forWho,
    included: toLines(service.included),
    addOns: toLines(service.addOns),
    recommendedFrequency: service.recommendedFrequency,
    prepare: toLines(service.prepare),
    isActive: service.isActive,
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setState("saving");
    setError("");
    const res = await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        included: fromLines(form.included),
        addOns: fromLines(form.addOns),
        prepare: fromLines(form.prepare),
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setState("error");
      setError(json.error || "Save failed");
      return;
    }
    setState("saved");
  }

  return (
    <details className="rounded-2xl border border-surface-200 bg-white p-4 open:pb-5">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between">
          <span className="font-semibold text-navy-950">{form.name}</span>
          <span className="text-xs text-surface-700">{form.isActive ? "Active" : "Hidden"}</span>
        </span>
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-surface-700">Name</span>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">Category</span>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ServiceContent["category"] }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm">
            <option value="home">Home</option>
            <option value="specialty">Specialty</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-surface-700">Short description (card teaser)</span>
          <textarea rows={2} value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">Image path</span>
          <input value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm font-mono" />
          <span className="mt-0.5 block text-[11px] text-surface-500">Must reference an existing file under /public/images — no upload yet.</span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">Image alt text</span>
          <input value={form.imageAlt} onChange={(e) => setForm((f) => ({ ...f, imageAlt: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-surface-700">Who it&apos;s for</span>
          <textarea rows={2} value={form.forWho} onChange={(e) => setForm((f) => ({ ...f, forWho: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">What&apos;s included (one per line)</span>
          <textarea rows={5} value={form.included} onChange={(e) => setForm((f) => ({ ...f, included: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">Add-ons (one per line)</span>
          <textarea rows={5} value={form.addOns} onChange={(e) => setForm((f) => ({ ...f, addOns: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">Recommended frequency</span>
          <input value={form.recommendedFrequency} onChange={(e) => setForm((f) => ({ ...f, recommendedFrequency: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-surface-700">How to prepare (one per line)</span>
          <textarea rows={3} value={form.prepare} onChange={(e) => setForm((f) => ({ ...f, prepare: e.target.value }))} className="mt-1 w-full rounded-lg border border-surface-200 px-2.5 py-1.5 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-navy-900">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Visible on the site
        </label>
        <button type="button" onClick={save} disabled={state === "saving"} className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-teal-400 disabled:opacity-60">
          {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
        </button>
        {state === "saved" && <span className="flex items-center gap-1 text-sm text-teal-700"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
        {state === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </details>
  );
}

export default function ServicesContentManager({ services }: { services: ServiceContent[] }) {
  return (
    <div className="space-y-3">
      {services.map((s) => (
        <ServiceRow key={s.id} service={s} />
      ))}
    </div>
  );
}
