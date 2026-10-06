import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { ComplianceItem } from "@/lib/server/smsCompliance";

const icon = { done: CheckCircle2, missing: XCircle, manual: HelpCircle } as const;
const iconClass = { done: "text-green-600", missing: "text-red-600", manual: "text-amber-600" } as const;

export default function TelnyxComplianceChecklist({ items }: { items: ComplianceItem[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-admin-text">Telnyx 10DLC readiness</h2>
      <p className="mt-1 text-sm text-admin-text-muted">
        Everything checkable from this app is checked for real -- nothing here is simulated. The last two items happen entirely inside Telnyx&apos;s own portal and must be confirmed there.
      </p>
      <ul className="mt-4 space-y-2 rounded-xl border border-admin-border bg-admin-card p-4">
        {items.map((item) => {
          const Icon = icon[item.status];
          return (
            <li key={item.label} className="flex items-start gap-2.5 text-sm">
              <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass[item.status]}`} aria-hidden />
              <div>
                <span className="font-medium text-admin-text">{item.label}</span>
                {item.detail && <span className="block text-xs text-admin-text-muted">{item.detail}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
