import type { ReactNode } from "react";
import Section from "@/components/ui/Section";

export default function PolicyLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Section className="max-w-3xl">
      <div className="mx-auto max-w-3xl">
        <h1 className="mt-8 text-4xl font-semibold text-navy-950">{title}</h1>
        <p className="mt-2 text-sm text-surface-700">Last updated: {updated}</p>

        <div className="mt-8 space-y-5 text-surface-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-navy-950 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-teal-600 [&_a]:underline">
          {children}
        </div>
      </div>
    </Section>
  );
}
