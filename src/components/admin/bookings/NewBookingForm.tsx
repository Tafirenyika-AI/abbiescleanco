"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { services } from "@/lib/data/services";
import type { CustomerOption } from "@/lib/server/customerStore";

export default function NewBookingForm() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [service, setService] = useState<string>(services[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [zip, setZip] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/customers")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setCustomers(json.customers);
      });
  }, []);

  async function submit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/bookings/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        service,
        amount: Math.round(Number(amount) * 100),
        addressLine1,
        addressLine2: addressLine2 || undefined,
        zip,
        scheduledStart: `${date}T${start}:00`,
        scheduledEnd: `${date}T${end}:00`,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) {
      setError(json.error || "Couldn't create booking");
      return;
    }
    router.push(`/admin/bookings/${json.id}`);
  }

  const valid = customerId && service && amount && addressLine1.trim() && /^\d{5}(-\d{4})?$/.test(zip.trim()) && date && start && end;

  return (
    <Card className="max-w-2xl">
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">Customer</span>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-admin-text-muted">
          Customer not listed yet? <Link href="/admin/customers/new" className="text-admin-teal-hover hover:underline">Add them first</Link>.
        </span>
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Service</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Amount ($)</span>
          <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-admin-text-muted">Street address</span>
          <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 Main St" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">ZIP</span>
          <input value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-admin-text-muted">Apt / unit (optional)</span>
          <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Start time</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">End time</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-admin-error">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!valid || saving}
        className="ios-press mt-4 flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Create booking
      </button>
    </Card>
  );
}
