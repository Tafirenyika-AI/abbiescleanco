import type { ReactNode } from "react";
import clsx from "clsx";

type Tone = "neutral" | "teal" | "success" | "warning" | "error" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  teal: "bg-admin-teal/10 text-admin-teal-hover",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
};

export default function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
