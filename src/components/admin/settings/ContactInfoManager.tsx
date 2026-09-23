"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { ContactInfo } from "@/lib/server/siteSettings";

/** Everywhere this shows up: header, footer, contact page, WhatsApp buttons, transactional emails, and the guest assistant -- all read this same value, no redeploy needed. */
export default function ContactInfoManager({ initialContact }: { initialContact: ContactInfo }) {
  const [contact, setContact] = useState(initialContact);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setState("saving");
    setError("");
    const res = await fetch("/api/admin/settings/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
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
      <h2 className="font-semibold text-slate-900">Contact info</h2>
      <p className="mt-1 text-sm text-admin-text-muted">The phone number, WhatsApp number, and email shown across the whole site — header, footer, contact page, emails, and the chat assistant.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Phone (how it displays)</span>
          <input
            value={contact.phoneDisplay}
            onChange={(e) => setContact((c) => ({ ...c, phoneDisplay: e.target.value }))}
            placeholder="(555) 123-4567"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Phone (for tel:/call links)</span>
          <input
            value={contact.phoneE164}
            onChange={(e) => setContact((c) => ({ ...c, phoneE164: e.target.value }))}
            placeholder="+15551234567"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">WhatsApp number (digits only)</span>
          <input
            value={contact.whatsappE164}
            onChange={(e) => setContact((c) => ({ ...c, whatsappE164: e.target.value }))}
            placeholder="15551234567"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Email</span>
          <input
            type="email"
            value={contact.email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === "saving"} className="ios-press inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
          {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save contact info"}
        </button>
        {state === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
        {state === "error" && <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="size-4" aria-hidden /> {error}</span>}
      </div>
    </section>
  );
}
