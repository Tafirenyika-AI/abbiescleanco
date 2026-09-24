"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import type { ServiceId } from "@/lib/data/services";

interface Slot {
  startISO: string;
  endISO: string;
  label: string;
}

/** Next 14 days, skipping today (self-service requires at least 24h notice). */
function upcomingDates(): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    out.push({ iso, label });
  }
  return out;
}

export default function BookNowPicker({ leadId, serviceId }: { leadId: string; serviceId: ServiceId }) {
  const dates = useMemo(() => upcomingDates(), []);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const slots = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];
  const loadingSlots = !!selectedDate && slotsByDate[selectedDate] === undefined;

  useEffect(() => {
    if (!selectedDate || slotsByDate[selectedDate] !== undefined) return;
    let cancelled = false;
    fetch(`/api/booking-slots?service=${encodeURIComponent(serviceId)}&date=${selectedDate}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setSlotsByDate((prev) => ({ ...prev, [selectedDate]: json.ok ? json.slots : [] }));
      })
      .catch(() => {
        if (!cancelled) setSlotsByDate((prev) => ({ ...prev, [selectedDate]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, serviceId, slotsByDate]);

  async function submit() {
    if (!selectedSlot || !addressLine1.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${leadId}/self-book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          scheduledStart: selectedSlot.startISO,
          scheduledEnd: selectedSlot.endISO,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Couldn't hold that time. Please try another slot.");
        return;
      }
      setDone(json.reference);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-5 text-center">
        <CheckCircle2 className="mx-auto size-8 text-teal-600" aria-hidden />
        <p className="mt-2 font-semibold text-navy-950">Time slot requested!</p>
        <p className="mt-1 text-sm text-surface-700">
          We&apos;re holding it for you and will confirm shortly. Reference: <strong>{done}</strong>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border-2 border-teal-500 px-5 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
      >
        <CalendarClock className="size-4" aria-hidden />
        Skip the wait, pick a time now
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-surface-200 bg-white p-5 text-left">
      <p className="font-semibold text-navy-950">Pick a time</p>
      <p className="mt-1 text-sm text-surface-700">This holds the slot as a request, our team still confirms it before it&apos;s final.</p>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {dates.map((d) => (
          <button
            key={d.iso}
            type="button"
            onClick={() => {
              setSelectedDate(d.iso);
              setSelectedSlot(null);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              selectedDate === d.iso ? "bg-navy-950 text-white" : "border border-surface-200 text-navy-700 hover:bg-surface-50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {selectedDate && (
        <div className="mt-3">
          {loadingSlots ? (
            <p className="flex items-center gap-2 text-sm text-surface-700">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-surface-700">No open times that day, try another date.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.startISO}
                  type="button"
                  onClick={() => setSelectedSlot(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    selectedSlot?.startISO === s.startISO ? "bg-teal-500 text-navy-950" : "border border-surface-200 text-navy-700 hover:bg-surface-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSlot && (
        <div className="mt-4 space-y-2">
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Street address</span>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Main St"
              className="mt-1 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Apt / unit (optional)</span>
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="mt-1 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!addressLine1.trim() || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-navy-950 hover:bg-teal-400 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Request {selectedSlot.label} on {dates.find((d) => d.iso === selectedDate)?.label}
          </button>
        </div>
      )}
    </div>
  );
}
