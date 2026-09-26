"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Loader2, RotateCcw, Eye } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import type { EmailTemplateListItem } from "@/lib/server/emailTemplates";

/** Realistic-looking sample values so the preview reads like a real email, not a wall of {{vars}}. */
function sampleValue(name: string): string {
  const samples: Record<string, string> = {
    firstName: "Jordan",
    name: "Jordan Rivera",
    reference: "ACM-26-4F3A9C",
    serviceName: "Deep Cleaning",
    estimateLabel: "$180-$260 (preliminary)",
    businessPhone: "(509) 555-0134",
    businessName: "Abbie's Clean Method",
    businessCity: "Spokane Valley",
    businessRegion: "WA",
    loginUrl: "https://abbiescleanco.vercel.app/admin/login",
    resetUrl: "https://abbiescleanco.vercel.app/admin/reset-password?token=sample",
    quoteNumber: "Q-26-8821",
    itemsRowsHtml: `<tr><td style="padding:6px 0">Deep Cleaning</td><td style="padding:6px 0;text-align:right">$220.00</td></tr><tr style="border-top:1px solid #e2e8f0;font-weight:bold"><td style="padding:8px 0">Total</td><td style="padding:8px 0;text-align:right">$220.00</td></tr>`,
    messageBlockHtml: "",
    expiresBlockHtml: `<p style="color:#4a5a6a;font-size:13px">This quote is valid until 10/15/2026.</p>`,
    amountLabel: "$150.00",
    description: "your deep cleaning (ACM-26-4F3A9C)",
    url: "https://abbiescleanco.vercel.app/pay/sample",
    scheduledStartLabel: "Tuesday, October 14 at 9:00 AM",
    methodBlockHtml: `<p style="color:#4a5a6a;font-size:14px">Paid via Card</p>`,
    receiptBlockHtml: `<p><a href="#" style="color:#0d8f83">View your receipt</a></p>`,
    dateLabel: "Tuesday, October 14 at 9:00 AM",
    arrivalWindowBlockHtml: " (9:00-9:30 AM arrival window)",
    cancellationUrl: "https://abbiescleanco.vercel.app/policies/cancellation",
    publicReviewUrl: "https://abbiescleanco.vercel.app/reviews",
    leadDetailsListHtml: `<li><strong>Reference:</strong> ACM-26-4F3A9C</li><li><strong>Name:</strong> Jordan Rivera</li><li><strong>Service:</strong> Deep Cleaning</li>`,
  };
  return samples[name] ?? `Sample ${name}`;
}

function renderPreview(subject: string, html: string, variables: string[]): { subject: string; html: string } {
  const vars: Record<string, string> = {};
  for (const v of variables) vars[v] = sampleValue(v);
  const substitute = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (full, name: string) => vars[name] ?? full);
  return { subject: substitute(subject), html: substitute(html) };
}

export default function EmailTemplateEditor({ template }: { template: EmailTemplateListItem }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(name: string) {
    const el = htmlRef.current;
    const token = `{{${name}}}`;
    if (!el) {
      setHtml((h) => h + token);
      return;
    }
    const start = el.selectionStart ?? html.length;
    const end = el.selectionEnd ?? html.length;
    const next = html.slice(0, start) + token + html.slice(end);
    setHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/settings/email-templates/${template.key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, html }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't save", "error");
    showToast("Saved.", "success");
    router.refresh();
  }

  async function resetToDefault() {
    setResetting(true);
    const res = await fetch(`/api/admin/settings/email-templates/${template.key}/reset`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setResetting(false);
    setConfirmReset(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't reset", "error");
    showToast("Reset to default.", "success");
    router.push("/admin/settings/email-templates");
    router.refresh();
  }

  async function askAi() {
    setAiBusy(true);
    const res = await fetch(`/api/admin/settings/email-templates/${template.key}/ai-improve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, html, instruction: aiInstruction.trim() || undefined }),
    });
    const data = await res.json().catch(() => null);
    setAiBusy(false);
    if (!data?.ok) return showToast(data?.error || "AI couldn't draft this", "error");
    setSubject(data.subject);
    setHtml(data.html);
    showToast("AI draft applied below -- review before saving.", "success");
  }

  const preview = renderPreview(subject, html, template.variables);

  return (
    <>
      <Link href="/admin/settings/email-templates" className="ios-press inline-flex items-center gap-1.5 text-sm font-medium text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> All email templates
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">{template.name}</h1>
          <p className="mt-0.5 text-sm text-admin-text-muted">{template.description}</p>
        </div>
        {template.isCustomized && <Badge tone="teal">Customized</Badge>}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-admin-text-muted">Body (HTML)</span>
              <textarea
                ref={htmlRef}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={16}
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 font-mono text-xs text-admin-text"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={save} disabled={saving} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-50">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save
              </button>
              {template.isCustomized && (
                <button type="button" onClick={() => setConfirmReset(true)} disabled={resetting} className="ios-press inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text-muted hover:text-admin-text disabled:opacity-50">
                  <RotateCcw className="size-3.5" aria-hidden /> Reset to default
                </button>
              )}
              <button type="button" onClick={() => setShowPreview((s) => !s)} className="ios-press ml-auto inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text-muted hover:text-admin-text lg:hidden">
                <Eye className="size-3.5" aria-hidden /> {showPreview ? "Hide" : "Show"} preview
              </button>
            </div>
          </Card>

          <Card>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-admin-text">
              <Sparkles className="size-4 text-admin-teal-hover" aria-hidden /> Ask AI to help
            </p>
            <p className="mt-1 text-xs text-admin-text-muted">Describe what to change, or leave blank for a general polish. Drafts here, never saves automatically -- review below before clicking Save.</p>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="e.g. make it warmer, or shorten it"
                className="flex-1 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              />
              <button type="button" onClick={askAi} disabled={aiBusy} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-navy px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                {aiBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Ask AI"}
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <p className="text-sm font-semibold text-admin-text">Variables</p>
            <p className="mt-1 text-xs text-admin-text-muted">Click to insert into the body. Every one of these must stay somewhere in the template.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)} className="ios-press rounded-full bg-admin-bg px-2.5 py-1 font-mono text-[11px] text-admin-text hover:bg-admin-border/60">
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </Card>

          {showPreview && (
            <Card padded={false}>
              <div className="border-b border-admin-border p-3">
                <p className="text-xs font-semibold uppercase text-admin-text-muted">Preview (sample data)</p>
                <p className="mt-1 truncate text-sm font-medium text-admin-text">{preview.subject}</p>
              </div>
              <iframe title="Email preview" srcDoc={preview.html} className="h-[500px] w-full rounded-b-2xl bg-white" sandbox="" />
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset this template?"
        description="Deletes your customization and goes back to the built-in default. This can't be undone."
        confirmLabel="Reset"
        onConfirm={resetToDefault}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
