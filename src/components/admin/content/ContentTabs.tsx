"use client";

import { useState, type ReactNode } from "react";

const tabs = ["Services", "FAQs", "Gallery", "Service areas"] as const;

export default function ContentTabs({ panels }: { panels: Record<(typeof tabs)[number], ReactNode> }) {
  const [active, setActive] = useState<(typeof tabs)[number]>("Services");

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-50 p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active === tab ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mt-6">{panels[active]}</div>
    </div>
  );
}
