import type { LucideIcon } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";

/**
 * Honest placeholder for a blueprint module that's on the roadmap but not built yet -- shows what
 * it will actually do, never fake data or a working-looking form. See docs/IMPLEMENTATION_PLAN.md
 * for the real status and what's blocking each one (more build time, vs. a credential/decision
 * only the business owner can provide).
 */
export default function ComingSoonModule({
  icon: Icon,
  title,
  tagline,
  blocked,
  capabilities,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  /** Why this isn't built yet -- "code" (just needs build time) or a specific credential/decision needed first. */
  blocked: { reason: string; detail: string };
  capabilities: string[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">{title}</h1>
          <p className="mt-1 text-sm text-admin-text-muted">{tagline}</p>
        </div>
        <Badge tone="warning">Not built yet</Badge>
      </div>

      <Card className="mt-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-admin-teal/10 text-admin-teal-hover">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-admin-text">What this will do</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-admin-text-muted">
              {capabilities.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="mt-4 bg-amber-50">
        <p className="text-sm font-semibold text-admin-text">Why it&apos;s not built yet</p>
        <p className="mt-1 text-sm text-admin-text">{blocked.reason}</p>
        <p className="mt-1 text-sm text-admin-text-muted">{blocked.detail}</p>
      </Card>
    </div>
  );
}
