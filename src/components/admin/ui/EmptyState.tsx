import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border px-6 py-12 text-center">
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-admin-bg text-admin-text-muted">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="mt-3 text-sm font-semibold text-admin-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-admin-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
