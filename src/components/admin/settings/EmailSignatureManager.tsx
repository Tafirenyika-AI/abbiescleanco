"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { EmailSignatureSettings } from "@/lib/server/siteSettings";

/** The name/title/tagline shown on the branded signature appended to every prospecting outreach
 *  email. Phone and email are edited separately above (Contact info) so they only live in one
 *  place -- this panel only covers the parts unique to the signature itself. */
export default function EmailSignatureManager({ initialSignature }: { initialSignature: EmailSignatureSettings }) {
  const [signature, setSignature] = useState(initialSignature);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setState("saving");
    setError("");
    const res = await fetch("/api/admin/settings/email-signature", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signature),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.issues?.[0]?.message || data.error || "Couldn't save");
      setState("error");
      return;
    }
    setState("saved");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-admin-card p-5">
      <h2 className="font-semibold text-slate-900">Email signature</h2>
      <p className="mt-1 text-sm text-admin-text-muted">
        The branded signature added automatically to the bottom of every prospecting outreach email (Prospecting tab), below whatever
        message an admin writes. Phone and email come from Contact info above.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">First name</span>
          <input
            value={signature.founderFirstName}
            onChange={(e) => setSignature((s) => ({ ...s, founderFirstName: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Last name</span>
          <input
            value={signature.founderLastName}
            onChange={(e) => setSignature((s) => ({ ...s, founderLastName: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Title</span>
          <input
            value={signature.founderTitle}
            onChange={(e) => setSignature((s) => ({ ...s, founderTitle: e.target.value }))}
            placeholder="Founder & Owner"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-500">Tagline</span>
          <input
            value={signature.tagline}
            onChange={(e) => setSignature((s) => ({ ...s, tagline: e.target.value }))}
            placeholder="Clean spaces. Thoughtful service. The Abbie's Method."
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === "saving"} className="ios-press inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
          {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save signature"}
        </button>
        {state === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
        {state === "error" && <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="size-4" aria-hidden /> {error}</span>}
      </div>
    </section>
  );
}
