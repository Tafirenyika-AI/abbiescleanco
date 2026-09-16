"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, X, ShieldAlert } from "lucide-react";

interface FieldMeta {
  key: string;
  label: string;
  isSecret: boolean;
  wired: boolean;
  help: string;
}

const fields: FieldMeta[] = [
  { key: "resendApiKey", label: "Resend API key", isSecret: true, wired: true, help: "Powers customer/business confirmation emails." },
  { key: "emailFrom", label: "Email \"from\" address", isSecret: false, wired: true, help: "e.g. Abbie's Clean Method <hello@abbiescleanco.com>" },
  { key: "twilioAccountSid", label: "Twilio Account SID", isSecret: true, wired: true, help: "SMS notifications when a customer opts in." },
  { key: "twilioAuthToken", label: "Twilio Auth Token", isSecret: true, wired: true, help: "" },
  { key: "twilioFromNumber", label: "Twilio From Number", isSecret: false, wired: true, help: "e.g. +16505551234" },
  { key: "stripeSecretKey", label: "Stripe Secret Key", isSecret: true, wired: false, help: "Not used by any code path yet — Phase 4 (deposits/payments)." },
  { key: "googleMapsApiKey", label: "Google Maps API Key", isSecret: true, wired: false, help: "Not used yet — ZIP is free-text today." },
  { key: "turnstileSiteKey", label: "Turnstile Site Key", isSecret: false, wired: false, help: "Not wired into any form yet." },
  { key: "turnstileSecretKey", label: "Turnstile Secret Key", isSecret: true, wired: false, help: "Not wired into any form yet." },
  { key: "sentryDsn", label: "Sentry DSN", isSecret: false, wired: false, help: "Not wired into error reporting yet." },
];

interface Status {
  configured: boolean;
  source: "database" | "environment" | "none";
  value?: string;
}

export default function IntegrationsManager({ initialStatus }: { initialStatus: Record<string, Status> }) {
  const [status, setStatus] = useState(initialStatus);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function saveField(key: string) {
    const value = drafts[key];
    if (!value) return;
    setSaving(key);
    await fetch("/api/admin/settings/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSaving(null);
    setSaved(key);
    setStatus((prev) => ({ ...prev, [key]: { configured: true, source: "database", value: fields.find((f) => f.key === key)?.isSecret ? undefined : value } }));
    setDrafts((prev) => ({ ...prev, [key]: "" }));
  }

  async function clearField(key: string) {
    setSaving(key);
    await fetch("/api/admin/settings/integrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: key }),
    });
    setSaving(null);
    setStatus((prev) => ({ ...prev, [key]: { configured: false, source: "none" } }));
  }

  return (
    <div>
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-sm text-slate-800">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <p>
          These are stored in the database, not a dedicated secrets vault — reasonable for a small
          business site behind admin login, but not the same guarantee as your host&apos;s
          encrypted environment variables. Values you save here take priority over environment
          variables of the same name.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {fields.map((field) => {
          const current = status[field.key];
          return (
            <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                  {field.help && <p className="text-xs text-slate-500">{field.help}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {!field.wired && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Not wired into code yet</span>}
                  {current?.configured ? (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-700">
                      Configured ({current.source === "database" ? "here" : "env var"})
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Not set</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type={field.isSecret ? "password" : "text"}
                  placeholder={current?.value || (current?.configured ? "•••• saved — enter a new value to replace" : "Not set")}
                  value={drafts[field.key] || ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => saveField(field.key)}
                  disabled={saving === field.key || !drafts[field.key]}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {saving === field.key ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Save"}
                </button>
                {current?.configured && current.source === "database" && (
                  <button
                    type="button"
                    onClick={() => clearField(field.key)}
                    aria-label={`Clear ${field.label}`}
                    className="flex size-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
                {saved === field.key && saving !== field.key && <CheckCircle2 className="size-4 text-teal-600" aria-hidden />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
