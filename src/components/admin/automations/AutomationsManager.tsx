"use client";

import { useState } from "react";
import { Loader2, Play, Zap } from "lucide-react";
import type { AutomationRules, AutomationEventLogItem, ConfigurableAutomationType } from "@/lib/server/automationStore";
import { automationRuleLabels, CONFIGURABLE_AUTOMATION_TYPES } from "@/lib/server/automationStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDateTime } from "@/lib/adminDate";

const offsetUnit: Partial<Record<ConfigurableAutomationType, "hours" | "days">> = {
  QUOTE_FOLLOW_UP_1: "hours",
  QUOTE_FOLLOW_UP_2: "hours",
  POST_SERVICE_THANK_YOU: "hours",
  WIN_BACK: "days",
};

const statusTone: Record<string, "neutral" | "info" | "success" | "error" | "warning"> = {
  PENDING: "info",
  SENT: "success",
  SKIPPED: "neutral",
  FAILED: "error",
  CANCELLED: "neutral",
};

export default function AutomationsManager({
  rules: initialRules,
  events,
}: {
  rules: AutomationRules;
  events: AutomationEventLogItem[];
}) {
  const { showToast } = useToast();
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  function setEnabled(type: ConfigurableAutomationType, enabled: boolean) {
    setRules((prev) => ({ ...prev, [type]: { ...prev[type], enabled } }));
  }
  function setOffsetDisplay(type: ConfigurableAutomationType, value: number) {
    const unit = offsetUnit[type];
    const hours = unit === "days" ? value * 24 : value;
    setRules((prev) => ({ ...prev, [type]: { ...prev[type], offsetHours: hours } }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/automations/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rules),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Couldn't save automation rules", "error");
      return;
    }
    showToast("Automation rules saved", "success");
  }

  async function runNow() {
    setRunning(true);
    const res = await fetch("/api/automation/process", { method: "POST" });
    const json = await res.json();
    setRunning(false);
    if (!res.ok || !json.ok) {
      showToast("Couldn't run automations", "error");
      return;
    }
    showToast(`Processed ${json.processed} — ${json.sent} sent, ${json.skipped} skipped, ${json.failed} failed`, "success");
    window.location.reload();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Automations</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            Time-delayed emails that fire automatically after a lead or booking event. A cron job checks for due
            events hourly — use &ldquo;Run now&rdquo; to process any due events immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="ios-press inline-flex items-center gap-1.5 rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg disabled:opacity-60"
        >
          {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />} Run now
        </button>
      </div>

      <Card className="mt-4">
        <h2 className="font-semibold text-admin-text">Rules</h2>
        <div className="mt-3 divide-y divide-admin-border">
          {CONFIGURABLE_AUTOMATION_TYPES.map((type) => {
            const rule = rules[type];
            const unit = offsetUnit[type];
            const displayValue = unit && rule.offsetHours ? (unit === "days" ? rule.offsetHours / 24 : rule.offsetHours) : undefined;
            return (
              <div key={type} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-admin-text">{automationRuleLabels[type]}</p>
                  {type === "WIN_BACK" && (
                    <p className="text-xs text-admin-text-muted">Off by default — review timing/tone before enabling.</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unit && (
                    <label className="flex items-center gap-1.5 text-xs text-admin-text-muted">
                      <input
                        type="number"
                        min={1}
                        value={displayValue ?? ""}
                        onChange={(e) => setOffsetDisplay(type, Number(e.target.value) || 1)}
                        className="w-16 rounded-lg border border-admin-border px-2 py-1 text-sm text-admin-text"
                      />
                      {unit}
                    </label>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    onClick={() => setEnabled(type, !rule.enabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${rule.enabled ? "bg-admin-teal" : "bg-admin-border"}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="ios-press mt-4 flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save rules
        </button>
      </Card>

      <div className="mt-6">
        <h2 className="font-semibold text-admin-text">Recent events</h2>
        <div className="mt-3 admin-table-surface overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
          {events.length === 0 ? (
            <EmptyState icon={Zap} title="No automation events yet" description="Scheduled follow-ups, reminders, and thank-you emails will show up here." />
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-admin-bg">
                <tr>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Type</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Lead / Booking</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Scheduled for</th>
                  <th scope="col" className="p-3.5 font-semibold text-admin-text">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-admin-border">
                    <td className="p-3.5 text-admin-text">{e.type.replace(/_/g, " ")}</td>
                    <td className="p-3.5 text-admin-text-muted">{e.leadReference ?? e.bookingReference ?? "—"}</td>
                    <td className="p-3.5 text-admin-text-muted">{e.scheduledFor ? formatDateTime(e.scheduledFor) : "—"}</td>
                    <td className="p-3.5"><Badge tone={statusTone[e.status] ?? "neutral"}>{e.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
