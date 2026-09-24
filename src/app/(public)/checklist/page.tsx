import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { checklist, tierOrder, tierLabels, tierIncludes } from "@/lib/data/checklist";

export const metadata: Metadata = {
  title: "Cleaning Checklist: Compare Standard, Deep & Move-In/Out",
  description:
    "A transparent, room-by-room cleaning checklist. Compare exactly what's included in Standard Cleaning, Deep Cleaning, and Move-In/Move-Out Cleaning.",
  alternates: { canonical: "/checklist" },
};

// Shares a layout with admin-editable footer content (social links) —
// revalidate so this page doesn't lag behind a deploy for that.
export const revalidate = 60;

export default function ChecklistPage() {
  return (
    <>
      <Section className="public-page-heading py-14 sm:py-16">
        <div className="max-w-2xl">
          <Eyebrow>Transparency, room by room</Eyebrow>
          <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">Cleaning checklist</h1>
          <p className="mt-4 text-surface-200">
            See exactly what&apos;s included at each level, room by room, so there are no surprises
            on cleaning day.
          </p>
        </div>
      </Section>

      <Section>
        {/* Desktop / tablet: comparison table */}
        <div className="hidden overflow-x-auto rounded-2xl border border-surface-200 md:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Cleaning checklist comparison by room and service tier</caption>
            <thead>
              <tr className="bg-surface-50">
                <th scope="col" className="sticky left-0 bg-surface-50 p-4 font-semibold text-navy-950">
                  Task
                </th>
                {tierOrder.map((tier) => (
                  <th key={tier} scope="col" className="p-4 text-center font-semibold text-navy-950">
                    {tierLabels[tier]}
                  </th>
                ))}
              </tr>
            </thead>
            {checklist.map((room) => (
              <tbody key={room.room} className="border-t border-surface-200">
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="bg-teal-50 p-3 text-left text-xs font-bold uppercase tracking-wide text-teal-700"
                  >
                    {room.room}
                  </th>
                </tr>
                {room.tasks.map((t) => (
                  <tr key={t.task} className="border-t border-surface-100">
                    <th scope="row" className="sticky left-0 bg-white p-3.5 font-normal text-navy-900">
                      {t.task}
                    </th>
                    {tierOrder.map((tier) => (
                      <td key={tier} className="p-3.5 text-center">
                        {tierIncludes(t.includedFrom, tier) ? (
                          <Check className="mx-auto size-4 text-teal-600" aria-label="Included" />
                        ) : (
                          <Minus className="mx-auto size-4 text-surface-200" aria-label="Not included" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        {/* Mobile: stacked cards per tier */}
        <div className="space-y-8 md:hidden">
          {tierOrder.map((tier) => (
            <div key={tier} className="rounded-2xl border border-surface-200 p-5">
              <h2 className="font-display text-lg font-semibold text-navy-950">{tierLabels[tier]}</h2>
              <div className="mt-4 space-y-5">
                {checklist.map((room) => {
                  const included = room.tasks.filter((t) => tierIncludes(t.includedFrom, tier));
                  if (included.length === 0) return null;
                  return (
                    <div key={room.room}>
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{room.room}</p>
                      <ul className="mt-2 space-y-1.5">
                        {included.map((t) => (
                          <li key={t.task} className="flex items-start gap-2 text-sm text-surface-700">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-teal-600" aria-hidden />
                            {t.task}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-surface-50 text-center">
        <h2 className="text-2xl font-semibold text-navy-950">Ready to book?</h2>
        <div className="mt-6">
          <Button href="/estimate" size="lg">Get My Free Estimate</Button>
        </div>
      </Section>
    </>
  );
}
