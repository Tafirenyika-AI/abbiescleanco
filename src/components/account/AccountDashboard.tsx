"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, FileSignature, CalendarClock, CreditCard, Settings, Tag } from "lucide-react";
import type { MyRequestItem, MyQuoteItem, MyBookingItem, MyPaymentItem } from "@/lib/server/customerHistory";
import type { PublicProfile } from "@/lib/server/accounts";
import AccountProfileForm from "@/components/account/AccountProfileForm";

const tabs = [
  { key: "requests", label: "Requests", icon: FileText },
  { key: "quotes", label: "Quotes", icon: FileSignature },
  { key: "bookings", label: "Bookings", icon: CalendarClock },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "settings", label: "Settings", icon: Settings },
] as const;
type TabKey = (typeof tabs)[number]["key"];

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "info" }) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-100 text-navy-700",
    success: "bg-teal-100 text-teal-600",
    warning: "bg-warm-100 text-warm-600",
    error: "bg-red-100 text-red-700",
    info: "bg-navy-900/10 text-navy-800",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function leadTone(status: string) {
  if (status === "LOST" || status === "CANCELLED") return "error" as const;
  if (status === "COMPLETED" || status === "CONFIRMED" || status === "SCHEDULED") return "success" as const;
  if (status === "NEW") return "info" as const;
  return "warning" as const;
}
function quoteTone(status: string) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "DECLINED" || status === "EXPIRED") return "error" as const;
  if (status === "SENT") return "info" as const;
  return "neutral" as const;
}
function bookingTone(status: string) {
  if (status === "CANCELLED") return "error" as const;
  if (status === "COMPLETED") return "success" as const;
  if (status === "REQUESTED") return "warning" as const;
  return "info" as const;
}
function paymentTone(status: string) {
  if (status === "PAID") return "success" as const;
  if (status === "FAILED") return "error" as const;
  if (status === "REFUNDED") return "neutral" as const;
  return "warning" as const;
}

function EmptyRow({ label }: { label: string }) {
  return <p className="rounded-2xl border border-dashed border-surface-200 p-6 text-center text-sm text-surface-700">{label}</p>;
}

export default function AccountDashboard({
  profile,
  requests,
  quotes,
  bookings,
  payments,
}: {
  profile: PublicProfile;
  requests: MyRequestItem[];
  quotes: MyQuoteItem[];
  bookings: MyBookingItem[];
  payments: MyPaymentItem[];
}) {
  const [active, setActive] = useState<TabKey>("requests");

  return (
    <div>
      <div className="ios-segment" role="tablist" aria-label="Account sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className="ios-segment-item inline-flex items-center gap-1.5"
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {active === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <EmptyRow label="No estimate requests yet." />
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy-950">{r.serviceName}</p>
                    <Pill tone={leadTone(r.status)}>{titleCase(r.status)}</Pill>
                  </div>
                  <p className="mt-1 text-sm text-surface-700">
                    Ref {r.reference} · {formatDate(r.createdAt)} · Estimate: {r.estimateLabel}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {active === "quotes" && (
          <div className="space-y-3">
            {quotes.length === 0 ? (
              <EmptyRow label="No quotes yet — once we build one for you, it'll show up here." />
            ) : (
              quotes.map((q) => (
                <div key={q.id} className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy-950">{q.quoteNumber} — {money(q.total)}</p>
                    <Pill tone={quoteTone(q.status)}>{titleCase(q.status)}</Pill>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-surface-700">
                    <span>{formatDate(q.createdAt)}</span>
                    {q.expiresAt && <span>Expires {formatDate(q.expiresAt)}</span>}
                    {q.promoCode && (
                      <span className="inline-flex items-center gap-1 text-teal-700">
                        <Tag className="size-3.5" aria-hidden /> {q.promoCode}
                      </span>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {active === "bookings" && (
          <div className="space-y-3">
            {bookings.length === 0 ? (
              <EmptyRow label="No bookings yet." />
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy-950">{b.serviceName}</p>
                    <Pill tone={bookingTone(b.status)}>{titleCase(b.status)}</Pill>
                  </div>
                  <p className="mt-1 text-sm text-surface-700">
                    Ref {b.reference} · {b.scheduledStart ? formatDateTime(b.scheduledStart) : "Not yet scheduled"}
                  </p>
                  <p className="mt-0.5 text-sm text-surface-700">{b.address}</p>
                </div>
              ))
            )}
          </div>
        )}

        {active === "payments" && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <EmptyRow label="No payments on file yet." />
            ) : (
              payments.map((p) => (
                <div key={p.id} className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy-950">{money(p.amount)} — {titleCase(p.kind.replace(/_/g, " "))}</p>
                    <Pill tone={paymentTone(p.status)}>{titleCase(p.status)}</Pill>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-surface-700">
                    <span>{formatDate(p.createdAt)}</span>
                    {p.bookingReference && <span>Booking {p.bookingReference}</span>}
                    {p.proofUrl && (
                      <Link href={p.proofUrl} target="_blank" className="font-semibold text-teal-700 hover:underline">
                        View receipt
                      </Link>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {active === "settings" && (
          <div className="max-w-xl">
            <AccountProfileForm profile={profile} />
          </div>
        )}
      </div>
    </div>
  );
}
