import type { ReactNode } from "react";
import clsx from "clsx";

export default function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={clsx(
        "admin-card rounded-2xl border border-admin-border bg-admin-card",
        padded && "p-5 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="admin-card-header flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-admin-text sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-admin-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
