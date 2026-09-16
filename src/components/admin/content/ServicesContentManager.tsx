"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { ServiceContent } from "@/lib/server/servicesContent";
import ImageUploadField from "./ImageUploadField";

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
    <details className="rounded-2xl border border-admin-border bg-admin-card p-4 open:pb-5">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between">
          <span className="font-semibold text-admin-text">{form.name}</span>
          <span className="text-xs text-admin-text-muted">{form.isActive ? "Active" : "Hidden"}</span>
        </span>
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Name</span>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Category</span>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ServiceContent["category"] }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm">
            <option value="home">Home</option>
            <option value="specialty">Specialty</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-admin-text-muted">Short description (card teaser)</span>
          <textarea rows={2} value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <ImageUploadField label="Image" value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Image alt text</span>
          <input value={form.imageAlt} onChange={(e) => setForm((f) => ({ ...f, imageAlt: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-admin-text-muted">Who it&apos;s for</span>
          <textarea rows={2} value={form.forWho} onChange={(e) => setForm((f) => ({ ...f, forWho: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">What&apos;s included (one per line)</span>
          <textarea rows={5} value={form.included} onChange={(e) => setForm((f) => ({ ...f, included: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Add-ons (one per line)</span>
          <textarea rows={5} value={form.addOns} onChange={(e) => setForm((f) => ({ ...f, addOns: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Recommended frequency</span>
          <input value={form.recommendedFrequency} onChange={(e) => setForm((f) => ({ ...f, recommendedFrequency: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">How to prepare (one per line)</span>
          <textarea rows={3} value={form.prepare} onChange={(e) => setForm((f) => ({ ...f, prepare: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-admin-text">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Visible on the site
        </label>
        <button type="button" onClick={save} disabled={state === "saving"} className="inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
          {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
        </button>
        {state === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
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
