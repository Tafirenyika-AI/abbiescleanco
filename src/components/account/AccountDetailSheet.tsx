"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, CreditCard, CalendarClock, XCircle, CheckCircle2, Truck } from "lucide-react";
import MediaThread from "@/components/account/MediaThread";
import { labelForMethod } from "@/lib/paymentMethods";

type Kind = "request" | "quote" | "booking";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const dt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok !== false, data };
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-surface-700">{heading}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// ---------------- Request ----------------
function RequestDetail({ id, status, instructions, onChanged }: { id: string; status: string; instructions: string; onChanged: () => void }) {
  const [text, setText] = useState(instructions);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = ["COMPLETED", "CANCELLED", "LOST"].includes(status);

  async function save() {
    setBusy(true);
    const r = await post(`/api/account/requests/${id}`, { instructions: text }, "PATCH");
    setBusy(false);
    setMsg(r.ok ? "Saved, our team has been notified." : r.data.error || "Couldn't save");
    if (r.ok) onChanged();
  }
  async function withdraw() {
    if (!confirm("Withdraw this request? You can always send a new one later.")) return;
    setBusy(true);
    const r = await post(`/api/account/requests/${id}/withdraw`, {});
    setBusy(false);
    if (r.ok) onChanged();
    else setMsg(r.data.error || "Couldn't withdraw");
  }

  return (
    <>
      <Section heading="What we need to know">
        <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={closed} rows={3} maxLength={2000} className="w-full rounded-2xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm text-navy-950 disabled:opacity-60" placeholder="Special instructions for this job" />
        {!closed && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={busy} className="ios-press rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save instructions</button>
            <button type="button" onClick={withdraw} disabled={busy} className="ios-press rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Withdraw request</button>
          </div>
        )}
        {msg && <p role="status" className="mt-2 text-sm text-surface-700">{msg}</p>}
      </Section>
      <Section heading="Notes, photos & videos">
        <MediaThread target={{ leadId: id }} readOnly={closed} />
      </Section>
    </>
  );
}

// ---------------- Quote ----------------
interface QuoteData {
  id: string; quoteNumber: string; status: string; subtotal: number; discount: number; tax: number; deposit: number; total: number;
  expiresAt: string | null; notes: string | null; serviceName: string; leadId: string; promoCode: string | null;
  items: { id: string; label: string; quantity: number; unitPrice: number; total: number }[];
}
function QuoteDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/account/quotes/${id}`).then((r) => r.json()).then((d) => { if (!cancelled && d.ok) setQuote(d.quote); });
    return () => { cancelled = true; };
  }, [id]);

  async function respond(action: "ACCEPT" | "DECLINE") {
    setBusy(true);
    const r = await post(`/api/account/quotes/${id}/respond`, { action, reason });
    setBusy(false);
    if (r.ok) {
      setQuote((q) => (q ? { ...q, status: r.data.status } : q));
      setDeclining(false);
      onChanged();
    } else setMsg(r.data.error || "Something went wrong");
  }

  if (!quote) return <p className="text-sm text-surface-700">Loading…</p>;
  return (
    <>
      <Section heading={`${quote.serviceName}, ${quote.quoteNumber}`}>
        <table className="w-full text-sm">
          <tbody>
            {quote.items.map((i) => (
              <tr key={i.id}><td className="py-1 text-navy-950">{i.label}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</td><td className="py-1 text-right">{money(i.total)}</td></tr>
            ))}
            {quote.discount > 0 && <tr><td className="py-1">Discount{quote.promoCode ? ` (${quote.promoCode})` : ""}</td><td className="py-1 text-right">-{money(quote.discount)}</td></tr>}
            {quote.tax > 0 && <tr><td className="py-1">Tax</td><td className="py-1 text-right">{money(quote.tax)}</td></tr>}
            <tr className="border-t border-surface-200 font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{money(quote.total)}</td></tr>
            {quote.deposit > 0 && <tr><td className="py-1 text-surface-700">Deposit to confirm</td><td className="py-1 text-right text-surface-700">{money(quote.deposit)}</td></tr>}
          </tbody>
        </table>
        {quote.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-surface-700">{quote.notes}</p>}
        {quote.expiresAt && <p className="mt-2 text-xs text-surface-700">Valid until {new Date(quote.expiresAt).toLocaleDateString("en-US")}</p>}
      </Section>
      {quote.status === "SENT" && (
        <Section heading="Your decision">
          {!declining ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => respond("ACCEPT")} disabled={busy} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} Accept quote
              </button>
              <button type="button" onClick={() => setDeclining(true)} className="ios-press rounded-full bg-surface-100 px-5 py-2.5 text-sm font-semibold text-navy-950">Decline</button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="What could we change? (optional, helps us send a better quote)" className="w-full rounded-2xl border border-surface-200 px-3.5 py-2.5 text-sm" />
              <div className="flex gap-2">
                <button type="button" onClick={() => respond("DECLINE")} disabled={busy} className="ios-press rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Confirm decline</button>
                <button type="button" onClick={() => setDeclining(false)} className="ios-press rounded-full bg-surface-100 px-4 py-2 text-sm font-semibold">Back</button>
              </div>
            </div>
          )}
        </Section>
      )}
      {quote.status !== "SENT" && <p className="mt-4 text-sm font-semibold text-navy-950">Status: {title(quote.status)}</p>}
      {msg && <p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}
      <Section heading="Questions or changes? Tell us">
        <MediaThread target={{ leadId: quote.leadId }} />
      </Section>
    </>
  );
}

// ---------------- Booking ----------------
interface BookingData {
  id: string; reference: string; status: string; scheduledStart: string | null; serviceName: string; serviceSlug: string | null; address: string;
  total: number | null; paid: number; balance: number | null;
  payments: { id: string; amount: number; status: string; kind: string; method: string | null; proofUrl: string | null; createdAt: string }[];
  history: { status: string; note: string | null; createdAt: string }[];
}
interface Slot { startISO: string; endISO: string; label: string }

function upcoming() {
  const out: { iso: string; label: string }[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({ iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) });
  }
  return out;
}

function BookingDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [b, setB] = useState<BookingData | null>(null);
  const [mode, setMode] = useState<"none" | "cancel" | "reschedule">("none");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [slot, setSlot] = useState<Slot | null>(null);
  const dates = useMemo(() => upcoming(), []);

  const reload = () => fetch(`/api/account/bookings/${id}`).then((r) => r.json()).then((d) => d.ok && setB(d.booking));
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/account/bookings/${id}`).then((r) => r.json()).then((d) => { if (!cancelled && d.ok) setB(d.booking); });
    return () => { cancelled = true; };
  }, [id]);

  async function pickDate(iso: string) {
    setDate(iso);
    setSlot(null);
    if (slots[iso] || !b?.serviceSlug) return;
    const d = await fetch(`/api/booking-slots?service=${b.serviceSlug}&date=${iso}`).then((r) => r.json()).catch(() => ({ slots: [] }));
    setSlots((s) => ({ ...s, [iso]: d.slots ?? [] }));
  }

  async function act(path: string, body: unknown, done: string) {
    setBusy(true);
    const r = await post(`/api/account/bookings/${id}/${path}`, body);
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error || "Something went wrong");
    setMsg(path === "cancel" && r.data.lateCancellation ? `${done} Because this is inside 24 hours of your start time, a late-cancellation fee may apply.` : done);
    setMode("none");
    await reload();
    onChanged();
  }
  async function payBalance() {
    setBusy(true);
    const r = await post(`/api/account/bookings/${id}/pay`);
    setBusy(false);
    if (r.ok && r.data.url) window.location.href = r.data.url;
    else setMsg(r.data.error || "Online payment isn't available right now, you can also pay by Zelle, Venmo, Apple Cash, check or cash.");
  }

  if (!b) return <p className="text-sm text-surface-700">Loading…</p>;
  const editable = !["CANCELLED", "COMPLETED", "IN_PROGRESS", "ON_THE_WAY"].includes(b.status);

  return (
    <>
      <Section heading={`${b.serviceName}, ${b.reference}`}>
        {b.status === "ON_THE_WAY" && (
          <p className="mb-2 flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
            <Truck className="size-4 shrink-0" aria-hidden /> Your cleaner is on the way!
          </p>
        )}
        <p className="text-sm text-navy-950">{b.scheduledStart ? dt(b.scheduledStart) : "Not yet scheduled"} · <span className="font-semibold">{title(b.status)}</span></p>
        <p className="mt-0.5 text-sm text-surface-700">{b.address}</p>
      </Section>

      <Section heading="Payment">
        {b.total === null ? (
          <p className="text-sm text-surface-700">Your total will appear here once we confirm pricing.</p>
        ) : (
          <>
            <p className="text-sm text-navy-950">Total {money(b.total)} · Paid {money(b.paid)} · <span className="font-semibold">Balance {money(b.balance ?? 0)}</span></p>
            {(b.balance ?? 0) >= 50 && b.status !== "CANCELLED" && (
              <button type="button" onClick={payBalance} disabled={busy} className="ios-press mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                <CreditCard className="size-4" aria-hidden /> Pay {money(b.balance ?? 0)} online
              </button>
            )}
          </>
        )}
        {b.payments.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {b.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span>{money(p.amount)} · {labelForMethod(p.method)} · {title(p.status)} · {new Date(p.createdAt).toLocaleDateString("en-US")}</span>
                {p.proofUrl && <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 hover:underline">Receipt</a>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {editable && (
        <Section heading="Change your booking">
          {mode === "none" && (
            <div className="flex flex-wrap gap-2">
              {b.serviceSlug && <button type="button" onClick={() => setMode("reschedule")} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-4 py-2 text-sm font-semibold"><CalendarClock className="size-4" aria-hidden /> Reschedule</button>}
              <button type="button" onClick={() => setMode("cancel")} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"><XCircle className="size-4" aria-hidden /> Cancel booking</button>
            </div>
          )}
          {mode === "cancel" && (
            <div className="space-y-2">
              <p className="text-sm text-surface-700">Cancelling inside 24 hours of your start time may incur a late-cancellation fee.</p>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (optional)" className="w-full rounded-2xl border border-surface-200 px-3.5 py-2.5 text-sm" />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => act("cancel", { reason }, "Your booking is cancelled.")} className="ios-press rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Yes, cancel it</button>
                <button type="button" onClick={() => setMode("none")} className="ios-press rounded-full bg-surface-100 px-4 py-2 text-sm font-semibold">Keep booking</button>
              </div>
            </div>
          )}
          {mode === "reschedule" && (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dates.map((d) => (
                  <button key={d.iso} type="button" onClick={() => pickDate(d.iso)} aria-pressed={date === d.iso} className={`ios-press shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${date === d.iso ? "bg-navy-950 text-white" : "bg-surface-100 text-navy-950"}`}>{d.label}</button>
                ))}
              </div>
              {date && slots[date] === undefined && <p className="text-sm text-surface-700">Loading times…</p>}
              {date && slots[date] && (slots[date].length === 0 ? <p className="text-sm text-surface-700">No openings that day, try another.</p> : (
                <div className="flex flex-wrap gap-2">
                  {slots[date].map((s) => (
                    <button key={s.startISO} type="button" onClick={() => setSlot(s)} aria-pressed={slot?.startISO === s.startISO} className={`ios-press rounded-full px-3.5 py-2 text-sm font-semibold ${slot?.startISO === s.startISO ? "bg-teal-600 text-white" : "bg-surface-100 text-navy-950"}`}>{s.label}</button>
                  ))}
                </div>
              ))}
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (optional)" className="w-full rounded-2xl border border-surface-200 px-3.5 py-2.5 text-sm" />
              <div className="flex gap-2">
                <button type="button" disabled={!slot || busy} onClick={() => slot && act("reschedule", { scheduledStart: slot.startISO, scheduledEnd: slot.endISO, reason }, "Request sent, we'll confirm your new time shortly.")} className="ios-press rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Request this time</button>
                <button type="button" onClick={() => setMode("none")} className="ios-press rounded-full bg-surface-100 px-4 py-2 text-sm font-semibold">Back</button>
              </div>
            </div>
          )}
        </Section>
      )}
      {msg && <p role="status" className="mt-3 text-sm text-navy-950">{msg}</p>}

      <Section heading="Notes, photos & videos for your crew">
        <MediaThread target={{ bookingId: id }} readOnly={b.status === "CANCELLED"} />
      </Section>

      {b.history.length > 0 && (
        <Section heading="Timeline">
          <ol className="space-y-1 text-sm text-surface-700">
            {b.history.map((h, i) => (
              <li key={i}><span className="font-semibold text-navy-950">{title(h.status)}</span> · {new Date(h.createdAt).toLocaleDateString("en-US")}{h.note ? `, ${h.note}` : ""}</li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}

// ---------------- Sheet ----------------
export interface DetailTarget {
  kind: Kind;
  id: string;
  heading: string;
  status?: string;
  instructions?: string;
}

export default function AccountDetailSheet({ target, onClose }: { target: DetailTarget; onClose: (changed: boolean) => void }) {
  const [changed, setChanged] = useState(false);
  const markChanged = () => setChanged(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(changed);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, changed]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose(changed)}>
      <div role="dialog" aria-modal="true" aria-label={target.heading} className="ios-sheet-in max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-navy-950">{target.heading}</h2>
          <button type="button" onClick={() => onClose(changed)} aria-label="Close" className="ios-press flex size-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06]"><X className="size-4" aria-hidden /></button>
        </div>
        {target.kind === "request" && <RequestDetail id={target.id} status={target.status ?? ""} instructions={target.instructions ?? ""} onChanged={markChanged} />}
        {target.kind === "quote" && <QuoteDetail id={target.id} onChanged={markChanged} />}
        {target.kind === "booking" && <BookingDetail id={target.id} onChanged={markChanged} />}
      </div>
    </div>
  );
}
