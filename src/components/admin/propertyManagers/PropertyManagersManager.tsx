"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, Loader2, X, Home, CalendarPlus, ExternalLink } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import Badge from "@/components/admin/ui/Badge";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate } from "@/lib/adminDate";
import { services } from "@/lib/data/services";
import type { PropertyManagerListItem, PropertyManagerDetail } from "@/lib/server/propertyManagerStore";
import type { CustomerOption } from "@/lib/server/customerStore";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const PROPERTY_TYPES = ["apartment", "house", "townhome", "commercial"] as const;

const bookingStatusTone: Record<string, "neutral" | "success" | "warning" | "info" | "error"> = {
  REQUESTED: "neutral", CONFIRMED: "info", SCHEDULED: "info", IN_PROGRESS: "warning", COMPLETED: "success", CANCELLED: "error", RESCHEDULED: "warning",
};

export default function PropertyManagersManager({ initialPropertyManagers }: { initialPropertyManagers: PropertyManagerListItem[] }) {
  const { showToast } = useToast();
  const [list, setList] = useState(initialPropertyManagers);
  const [selected, setSelected] = useState<PropertyManagerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showAddPM, setShowAddPM] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[] | null>(null);
  const [pickedCustomerId, setPickedCustomerId] = useState("");

  const [showAddProperty, setShowAddProperty] = useState(false);
  const [pLabel, setPLabel] = useState("");
  const [pLine1, setPLine1] = useState("");
  const [pLine2, setPLine2] = useState("");
  const [pCity, setPCity] = useState("Spokane Valley");
  const [pState, setPState] = useState("WA");
  const [pZip, setPZip] = useState("");
  const [pType, setPType] = useState<(typeof PROPERTY_TYPES)[number]>("apartment");

  const [scheduleFor, setScheduleFor] = useState<string | null>(null); // addressId
  const [sService, setSService] = useState<string>(services[0]?.id ?? "");
  const [sAmount, setSAmount] = useState("");
  const [sDate, setSDate] = useState("");
  const [sStart, setSStart] = useState("09:00");
  const [sEnd, setSEnd] = useState("11:00");

  async function refreshList() {
    const res = await fetch("/api/admin/property-managers");
    const data = await res.json().catch(() => null);
    if (data?.ok) setList(data.propertyManagers);
  }

  async function openDetail(customerId: string) {
    setLoadingDetail(true);
    setSelected(null);
    const res = await fetch(`/api/admin/property-managers/${customerId}`);
    const data = await res.json().catch(() => null);
    setLoadingDetail(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't load this property manager", "error");
    setSelected(data.propertyManager);
  }

  async function openAddPM() {
    setShowAddPM(true);
    if (!customerOptions) {
      const res = await fetch("/api/admin/customers");
      const data = await res.json().catch(() => null);
      setCustomerOptions(data?.ok ? data.customers : []);
    }
  }

  async function addPropertyManager() {
    if (!pickedCustomerId) return showToast("Pick a customer", "error");
    setBusy(true);
    const res = await fetch("/api/admin/property-managers", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerId: pickedCustomerId }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't add property manager", "error");
    showToast("Added as a property manager.", "success");
    setShowAddPM(false);
    setPickedCustomerId("");
    await refreshList();
    await openDetail(pickedCustomerId);
  }

  async function removePropertyManager(customerId: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/property-managers/${customerId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't remove", "error");
    showToast("Removed from property managers (customer record untouched).", "success");
    setSelected(null);
    await refreshList();
  }

  async function addProperty() {
    if (!selected) return;
    if (!pLine1.trim() || !/^\d{5}(-\d{4})?$/.test(pZip.trim())) return showToast("Enter a real street address and ZIP", "error");
    setBusy(true);
    const res = await fetch(`/api/admin/property-managers/${selected.customerId}/properties`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: pLabel.trim() || null, line1: pLine1.trim(), line2: pLine2.trim() || null, city: pCity.trim(), state: pState.trim(), zip: pZip.trim(), propertyType: pType }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't add property", "error");
    showToast("Property added.", "success");
    setShowAddProperty(false);
    setPLabel(""); setPLine1(""); setPLine2(""); setPZip("");
    await openDetail(selected.customerId);
    await refreshList();
  }

  async function scheduleTurnover() {
    if (!selected || !scheduleFor) return;
    if (!sAmount || !sDate) return showToast("Fill in the amount and date", "error");
    setBusy(true);
    const res = await fetch(`/api/admin/property-managers/${selected.customerId}/schedule`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        addressId: scheduleFor, service: sService, amount: Math.round(Number(sAmount) * 100),
        scheduledStart: `${sDate}T${sStart}:00`, scheduledEnd: `${sDate}T${sEnd}:00`,
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't schedule the turnover", "error");
    showToast("Turnover scheduled.", "success");
    setScheduleFor(null);
    setSAmount(""); setSDate("");
    await openDetail(selected.customerId);
    await refreshList();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">Property managers</h1>
          <p className="mt-1 text-sm text-admin-text-muted">Customers who manage multiple properties -- see their whole portfolio and schedule a turnover clean at any property in a couple clicks.</p>
        </div>
        <button type="button" onClick={openAddPM} className="ios-press inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
          <Plus className="size-4" aria-hidden /> Add property manager
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Building2} title="No property managers yet" description="Flag an existing customer as a property manager to start tracking their portfolio here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((pm) => (
            <button key={pm.customerId} type="button" onClick={() => openDetail(pm.customerId)} className="ios-press text-left">
              <Card className={selected?.customerId === pm.customerId ? "ring-2 ring-admin-teal" : ""}>
                <p className="text-sm font-semibold text-admin-text">{pm.name}</p>
                <p className="mt-0.5 text-xs text-admin-text-muted">{pm.email}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-semibold text-admin-text">{pm.propertyCount}</p><p className="text-[11px] text-admin-text-muted">Properties</p></div>
                  <div><p className="text-lg font-semibold text-admin-text">{pm.upcomingCount}</p><p className="text-[11px] text-admin-text-muted">Upcoming</p></div>
                  <div><p className="text-lg font-semibold text-admin-text">{pm.totalBookings}</p><p className="text-[11px] text-admin-text-muted">Total jobs</p></div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {loadingDetail && <p className="text-sm text-admin-text-muted"><Loader2 className="mr-1.5 inline size-4 animate-spin" aria-hidden />Loading…</p>}

      {selected && (
        <div className="rounded-2xl border border-admin-border bg-admin-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-admin-text">{selected.name}</h2>
              <p className="text-xs text-admin-text-muted">{selected.email} · {selected.phone}</p>
              <Link href={`/admin/customers/${selected.customerId}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
                View full customer profile <ExternalLink className="size-3" aria-hidden />
              </Link>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddProperty(true)} className="ios-press inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg">
                <Plus className="size-3.5" aria-hidden /> Add property
              </button>
              <button type="button" disabled={busy} onClick={() => removePropertyManager(selected.customerId)} className="ios-press rounded-full px-3 py-1.5 text-xs font-semibold text-admin-text-muted hover:bg-admin-bg disabled:opacity-50">
                Remove
              </button>
            </div>
          </div>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Properties ({selected.properties.length})</h3>
          {selected.properties.length === 0 ? (
            <p className="mt-1.5 text-xs text-admin-text-muted">No properties on file yet -- add one above.</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {selected.properties.map((p) => (
                <div key={p.id} className="rounded-xl border border-admin-border bg-admin-bg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      <Home className="mt-0.5 size-3.5 shrink-0 text-admin-text-muted" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-admin-text">{p.label || p.line1}</p>
                        <p className="text-xs text-admin-text-muted">{p.line1}{p.line2 ? `, ${p.line2}` : ""}, {p.city}, {p.state} {p.zip}</p>
                        <p className="text-[11px] text-admin-text-muted">{p.propertyType} · {p.bookingCount} job{p.bookingCount === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setScheduleFor(p.id); setSDate(""); setSAmount(""); }} className="ios-press mt-2 inline-flex items-center gap-1.5 rounded-full bg-admin-teal/10 px-2.5 py-1 text-xs font-semibold text-admin-teal-hover hover:bg-admin-teal/20">
                    <CalendarPlus className="size-3.5" aria-hidden /> Schedule turnover
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Recent bookings across the portfolio</h3>
          {selected.bookings.length === 0 ? (
            <p className="mt-1.5 text-xs text-admin-text-muted">No bookings yet.</p>
          ) : (
            <div className="mt-2 admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
              <table className="w-full text-sm">
                <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
                  <tr><th className="px-3 py-2">Property</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Amount</th></tr>
                </thead>
                <tbody>
                  {selected.bookings.map((b) => {
                    const prop = selected.properties.find((p) => p.id === b.addressId);
                    return (
                      <tr key={b.id} className="border-t border-admin-border">
                        <td className="px-3 py-2 text-admin-text">{prop?.label || prop?.line1 || "—"}</td>
                        <td className="px-3 py-2 text-admin-text-muted">{b.scheduledStart ? formatDate(b.scheduledStart) : "—"}</td>
                        <td className="px-3 py-2"><Badge tone={bookingStatusTone[b.status] ?? "neutral"}>{b.status}</Badge></td>
                        <td className="px-3 py-2 text-admin-text-muted">{b.amount !== null ? money(b.amount) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddPM && (
        <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setShowAddPM(false)}>
          <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-admin-text">Add a property manager</h2>
            <p className="mt-1 text-xs text-admin-text-muted">Pick an existing customer to flag as a property manager -- their record and history stay exactly the same, this just surfaces them here.</p>
            <select value={pickedCustomerId} onChange={(e) => setPickedCustomerId(e.target.value)} className="mt-3 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
              <option value="">{customerOptions === null ? "Loading…" : "Select a customer…"}</option>
              {(customerOptions ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}, {c.email}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddPM(false)} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
              <button type="button" disabled={busy || !pickedCustomerId} onClick={addPropertyManager} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddProperty && selected && (
        <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setShowAddProperty(false)}>
          <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-admin-text">Add a property for {selected.name}</h2>
            <div className="mt-3 space-y-2.5">
              <input value={pLabel} onChange={(e) => setPLabel(e.target.value)} placeholder="Nickname (optional), e.g. Unit 4B" className="w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              <input value={pLine1} onChange={(e) => setPLine1(e.target.value)} placeholder="Street address" className="w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              <input value={pLine2} onChange={(e) => setPLine2(e.target.value)} placeholder="Apt / unit (optional)" className="w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              <div className="grid grid-cols-3 gap-2">
                <input value={pCity} onChange={(e) => setPCity(e.target.value)} placeholder="City" className="rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
                <input value={pState} onChange={(e) => setPState(e.target.value)} placeholder="State" className="rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
                <input value={pZip} onChange={(e) => setPZip(e.target.value)} placeholder="ZIP" className="rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
              </div>
              <select value={pType} onChange={(e) => setPType(e.target.value as (typeof PROPERTY_TYPES)[number])} className="w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddProperty(false)} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
              <button type="button" disabled={busy} onClick={addProperty} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {busy ? "Adding…" : "Add property"}
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleFor && selected && (
        <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setScheduleFor(null)}>
          <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-admin-text">Schedule a turnover</h2>
              <button type="button" onClick={() => setScheduleFor(null)} aria-label="Close" className="text-admin-text-muted hover:text-admin-text"><X className="size-4" aria-hidden /></button>
            </div>
            <p className="mt-1 text-xs text-admin-text-muted">{selected.properties.find((p) => p.id === scheduleFor)?.label || selected.properties.find((p) => p.id === scheduleFor)?.line1}</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Service</span>
                <select value={sService} onChange={(e) => setSService(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Amount ($)</span>
                <input type="number" min="1" step="0.01" value={sAmount} onChange={(e) => setSAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Date</span>
                <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Start</span>
                  <input type="time" value={sStart} onChange={(e) => setSStart(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">End</span>
                  <input type="time" value={sEnd} onChange={(e) => setSEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleFor(null)} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
              <button type="button" disabled={busy || !sAmount || !sDate} onClick={scheduleTurnover} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {busy ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
