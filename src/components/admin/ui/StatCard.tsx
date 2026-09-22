import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowDownRight, ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import Card from "./Card";

export default function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  delta,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  href?: string;
  hint?: string;
  /** Real, computed trend only -- omit rather than invent one. Positive isn't always "good" (e.g. cancellations), so callers pass tone explicitly via sign + hint text. */
  delta?: { value: string; tone: "up" | "down" | "flat" };
}) {
  const body = (
    <Card className="group h-full transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-admin-teal/10 text-admin-teal-hover">
          <Icon className="size-4.5" aria-hidden />
        </span>
        {delta && (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              delta.tone === "up" && "bg-admin-success/10 text-admin-success",
              delta.tone === "down" && "bg-admin-error/10 text-admin-error",
              delta.tone === "flat" && "bg-admin-bg text-admin-text-muted"
            )}
          >
            {delta.tone === "up" && <ArrowUpRight className="size-3" aria-hidden />}
            {delta.tone === "down" && <ArrowDownRight className="size-3" aria-hidden />}
            {delta.value}
          </span>
        )}
      </div>
      <p className="mt-3.5 text-sm font-medium text-admin-text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-admin-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-admin-text-muted">{hint}</p>}
      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover opacity-0 transition-opacity group-hover:opacity-100">
          View <ArrowRight className="size-3" aria-hidden />
        </span>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
