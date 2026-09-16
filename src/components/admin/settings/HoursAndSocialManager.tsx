"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { BusinessHoursRow, SocialLinks } from "@/lib/server/siteSettings";

export default function HoursAndSocialManager({
  initialHours,
  initialSocial,
}: {
  initialHours: BusinessHoursRow[];
  initialSocial: SocialLinks;
}) {
  const [hours, setHours] = useState(initialHours);
  const [social, setSocial] = useState(initialSocial);
  const [hoursState, setHoursState] = useState<"idle" | "saving" | "saved">("idle");
  const [socialState, setSocialState] = useState<"idle" | "saving" | "saved">("idle");

  function updateHour(index: number, field: "days" | "time", value: string) {
    setHours((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  }

  async function saveHours() {
    setHoursState("saving");
    await fetch("/api/admin/settings/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    setHoursState("saved");
  }

  async function saveSocial() {
    setSocialState("saving");
    await fetch("/api/admin/settings/social", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(social),
    });
    setSocialState("saved");
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-admin-card p-5">
        <h2 className="font-semibold text-slate-900">Business hours</h2>
        <div className="mt-4 space-y-3">
          {hours.map((h, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <input
                value={h.days}
                onChange={(e) => updateHour(i, "days", e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
              <input
                value={h.time}
                onChange={(e) => updateHour(i, "time", e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveHours} disabled={hoursState === "saving"} className="inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {hoursState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save hours"}
          </button>
          {hoursState === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-admin-card p-5">
        <h2 className="font-semibold text-slate-900">Social links</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Facebook URL</span>
            <input
              value={social.facebook || ""}
              onChange={(e) => setSocial((s) => ({ ...s, facebook: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">TikTok URL</span>
            <input
              value={social.tiktok || ""}
              onChange={(e) => setSocial((s) => ({ ...s, tiktok: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveSocial} disabled={socialState === "saving"} className="inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {socialState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save links"}
          </button>
          {socialState === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
        </div>
      </section>
    </div>
  );
}
