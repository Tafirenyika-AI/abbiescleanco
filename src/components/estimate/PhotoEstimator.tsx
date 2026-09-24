"use client";

import { useState } from "react";
import { Camera, Loader2, Sparkles, X, CheckCircle2 } from "lucide-react";

interface Finding { photo: number; area: string; condition: string; issues: string[] }
interface Result {
  photoEstimateId: string | null;
  mode: "ai" | "fallback";
  notice?: string;
  service: string;
  condition: "light" | "normal" | "heavy" | "very-heavy";
  addOns: string[];
  requiresManualQuote: boolean;
  low: number;
  high: number;
  hoursLow: number;
  hoursHigh: number;
  findings: Finding[];
  supplies: string[];
  staffNotes: string;
}
interface Details { areaType: string; propertyType: "apartment" | "house" | "townhome"; squareFeet: string; bedrooms: string; bathrooms: string; hasPets: boolean; zip: string }

const AREAS = ["Whole home", "Kitchen", "Bathroom", "Living areas", "Bedrooms", "Move-in / move-out"];
const conditionLabel: Record<string, string> = { light: "Light upkeep", normal: "Everyday", heavy: "Needs a deeper clean", "very-heavy": "Significant build-up" };
const field = "mt-1 w-full rounded-2xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm text-navy-950";

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function PhotoEstimator({ addOnLabels, serviceNames, isLoggedIn }: { addOnLabels: Record<string, string>; serviceNames: Record<string, string>; isLoggedIn: boolean }) {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [d, setD] = useState<Details>({ areaType: "Whole home", propertyType: "house", squareFeet: "1500", bedrooms: "3", bathrooms: "2", hasPets: false, zip: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "", accept: false });
  const [sent, setSent] = useState<{ reference: string } | null>(null);
  const [gotcha, setGotcha] = useState("");
  const [shareWithTeam, setShareWithTeam] = useState(true);
  const [customerNotes, setCustomerNotes] = useState("");

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    for (const f of Array.from(list)) {
      if (next.length >= 6) break;
      if (!f.type.startsWith("image/")) continue;
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setPhotos(next);
  }

  async function analyze() {
    setError("");
    if (photos.length === 0) return setError("Add at least one photo of the area you'd like cleaned.");
    if (!/^\d{5}$/.test(d.zip)) return setError("Enter your 5-digit ZIP code.");
    setBusy(true);
    const form = new FormData();
    for (const p of photos) form.append("photos", await shrink(p.file));
    for (const [k, v] of Object.entries({ areaType: d.areaType, propertyType: d.propertyType, squareFeet: d.squareFeet, bedrooms: d.bedrooms, bathrooms: d.bathrooms, hasPets: String(d.hasPets), _gotcha: gotcha })) form.set(k, v);
    const res = await fetch("/api/photo-estimate", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) return setError(data.error || "Something went wrong — please try again.");
    setResult(data);
  }

  async function submitRequest() {
    if (!result) return;
    setError("");
    if (!contact.firstName || !contact.lastName || !contact.email || !contact.phone) return setError("Please fill in your name, email and phone.");
    if (!contact.accept) return setError("Please accept the service policies to continue.");
    setBusy(true);
    if (result.photoEstimateId) {
      await fetch(`/api/photo-estimate/${result.photoEstimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: shareWithTeam, customerNotes: customerNotes || undefined }),
      }).catch(() => {}); // best-effort — a failure here shouldn't block sending the request itself
    }
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zip: d.zip, propertyType: d.propertyType, squareFeet: Number(d.squareFeet), bedrooms: Number(d.bedrooms), bathrooms: Number(d.bathrooms),
        service: result.service, frequency: "one-time", condition: result.condition, hasPets: d.hasPets, addOns: result.addOns,
        firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone, preferredContactMethod: "EMAIL",
        additionalInstructions: `Requested via photo estimate (${d.areaType}).`, smsConsent: false, emailConsent: true, policiesAccepted: true,
        source: "photo-estimate", photoEstimateId: result.photoEstimateId ?? undefined, _gotcha: "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) return setError(data.error || "Couldn't send your request — please try again.");
    setSent({ reference: data.reference });
  }

  if (sent) {
    return (
      <div className="glass-card rounded-[28px] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
        <CheckCircle2 className="mx-auto size-10 text-teal-600" aria-hidden />
        <h2 className="mt-3 text-2xl font-semibold text-navy-950">Request sent</h2>
        <p className="mt-2 text-surface-700">Reference <strong>{sent.reference}</strong>. Your photos went to our team so we can confirm the price and bring the right supplies. Check your email for a confirmation.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="glass-card rounded-[28px] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-700"><Sparkles className="size-4" aria-hidden /> {result.mode === "ai" ? "Estimate from your photos" : "Preliminary estimate"}</p>
          <p className="mt-2 text-4xl font-semibold text-navy-950">{result.requiresManualQuote ? "Custom quote" : `$${result.low}–$${result.high}`}</p>
          <p className="mt-1 text-sm text-surface-700">
            {serviceNames[result.service] ?? result.service}{!result.requiresManualQuote && ` · about ${result.hoursLow}–${result.hoursHigh} hours`} · {conditionLabel[result.condition]}
          </p>
          {result.requiresManualQuote && <p className="mt-2 text-sm text-surface-700">We&apos;d like a person to look at these photos before pricing — send your request and we&apos;ll follow up.</p>}
          {result.notice && <p className="mt-3 rounded-2xl bg-warm-100 px-3.5 py-2.5 text-sm text-warm-600">{result.notice}</p>}
          {result.addOns.length > 0 && <p className="mt-3 text-sm text-navy-950">Included add-ons: {result.addOns.map((k) => addOnLabels[k] ?? k).join(", ")}</p>}
          {result.findings.length > 0 && (
            <ul className="mt-4 space-y-2">
              {result.findings.map((f, i) => (
                <li key={i} className="rounded-2xl bg-surface-100 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-navy-950">{f.area}</span> <span className="text-surface-700">· {conditionLabel[f.condition]}</span>
                  {f.issues.length > 0 && <span className="block text-surface-700">{f.issues.join(" · ")}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-surface-700">This is a preliminary estimate based on your photos and answers. Final pricing is confirmed by our team before anything is booked.</p>
        </div>

        {(result.supplies.length > 0 || result.staffNotes) && (
          <div className="glass-card rounded-[28px] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
            <h3 className="text-lg font-semibold text-navy-950">Review your photo assessment</h3>
            <p className="mt-1 text-sm text-surface-700">This is exactly what our team will see if you choose to share it. Add anything to correct or clarify before you send your request.</p>
            {result.staffNotes && <p className="mt-3 rounded-2xl bg-surface-100 px-3.5 py-2.5 text-sm text-navy-950">{result.staffNotes}</p>}
            {result.supplies.length > 0 && <p className="mt-3 text-sm text-surface-700"><span className="font-semibold text-navy-950">What we&apos;ll bring:</span> {result.supplies.join(", ")}</p>}
            <label className="mt-4 block text-sm font-medium text-navy-950">
              Anything to add or correct?
              <textarea
                className={`${field} min-h-[80px]`}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Optional — e.g. the stain in the kitchen is actually on the ceiling, not the counter."
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-navy-950">
              <input type="checkbox" checked={shareWithTeam} onChange={(e) => setShareWithTeam(e.target.checked)} className="mt-0.5" />
              <span>Share this assessment with our cleaning crew so they come prepared.</span>
            </label>
          </div>
        )}

        <div className="glass-card rounded-[28px] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
          <h3 className="text-lg font-semibold text-navy-950">Send this to our team</h3>
          <p className="mt-1 text-sm text-surface-700">We&apos;ll review your photos, confirm the price and reply with available times.{isLoggedIn ? " It will appear in your account." : ""}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-navy-950">First name<input className={field} value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} autoComplete="given-name" /></label>
            <label className="block text-sm font-medium text-navy-950">Last name<input className={field} value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} autoComplete="family-name" /></label>
            <label className="block text-sm font-medium text-navy-950">Email<input type="email" className={field} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" /></label>
            <label className="block text-sm font-medium text-navy-950">Phone<input type="tel" className={field} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" /></label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-navy-950">
            <input type="checkbox" checked={contact.accept} onChange={(e) => setContact({ ...contact, accept: e.target.checked })} className="mt-0.5" />
            <span>I&apos;ve read and accept the <a href="/policies" target="_blank" className="font-semibold text-teal-700 underline">service policies</a>.</span>
          </label>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={submitRequest} disabled={busy} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Request this estimate
            </button>
            <button type="button" onClick={() => setResult(null)} className="ios-press rounded-full bg-surface-100 px-5 py-3 text-sm font-semibold text-navy-950">Change photos</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 glass-card rounded-[28px] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
      <div>
        <h2 className="text-lg font-semibold text-navy-950">1. Show us what needs cleaning</h2>
        <p className="mt-1 text-sm text-surface-700">Add up to 6 photos — kitchen, bathrooms, floors, anything you&apos;re worried about. Wide shots and close-ups both help.</p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((p, i) => (
            <li key={p.preview} className="relative overflow-hidden rounded-xl ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`} className="ios-press absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"><X className="size-3.5" aria-hidden /></button>
            </li>
          ))}
          {photos.length < 6 && (
            <li>
              <label className="ios-press flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-surface-200 text-xs font-semibold text-surface-700">
                <Camera className="size-5" aria-hidden /> Add
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
              </label>
            </li>
          )}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-navy-950">2. A few details</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="col-span-2 block text-sm font-medium text-navy-950 sm:col-span-1">What&apos;s in the photos?
            <select className={field} value={d.areaType} onChange={(e) => setD({ ...d, areaType: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
          </label>
          <label className="block text-sm font-medium text-navy-950">Home type
            <select className={field} value={d.propertyType} onChange={(e) => setD({ ...d, propertyType: e.target.value as Details["propertyType"] })}><option value="house">House</option><option value="apartment">Apartment</option><option value="townhome">Townhome</option></select>
          </label>
          <label className="block text-sm font-medium text-navy-950">ZIP code<input className={field} inputMode="numeric" maxLength={5} value={d.zip} onChange={(e) => setD({ ...d, zip: e.target.value.replace(/\D/g, "") })} autoComplete="postal-code" /></label>
          <label className="block text-sm font-medium text-navy-950">Sq ft<input className={field} inputMode="numeric" value={d.squareFeet} onChange={(e) => setD({ ...d, squareFeet: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="block text-sm font-medium text-navy-950">Bedrooms<input className={field} inputMode="numeric" value={d.bedrooms} onChange={(e) => setD({ ...d, bedrooms: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="block text-sm font-medium text-navy-950">Bathrooms<input className={field} inputMode="numeric" value={d.bathrooms} onChange={(e) => setD({ ...d, bathrooms: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-navy-950"><input type="checkbox" checked={d.hasPets} onChange={(e) => setD({ ...d, hasPets: e.target.checked })} /> We have pets</label>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={gotcha} onChange={(e) => setGotcha(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="_gotcha" />
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" onClick={analyze} disabled={busy} className="ios-press inline-flex items-center gap-2 rounded-full bg-navy-950 px-7 py-3.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} {busy ? "Analysing your photos…" : "Get my photo estimate"}
      </button>
      <p className="text-xs text-surface-700">Photos are used only to prepare your estimate and are shared with our team. Location data is removed from them.</p>
    </div>
  );
}
