import { clsx } from "clsx";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "ios-press inline-flex items-center justify-center gap-1.5 rounded-full font-semibold tracking-[-0.01em] focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-admin-teal text-white shadow-[0_1px_2px_rgba(15,157,138,0.25),0_6px_16px_rgba(15,157,138,0.22)] hover:bg-admin-teal-hover",
  secondary: "bg-admin-bg text-admin-text hover:bg-admin-border/60",
  outline: "border border-admin-border bg-admin-card text-admin-text hover:bg-admin-bg",
  ghost: "text-admin-text-muted hover:bg-admin-bg hover:text-admin-text",
  danger: "bg-red-50 text-red-700 hover:bg-red-100",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  loading?: boolean;
  children: ReactNode;
}

type ButtonAsLink = CommonProps & {
  href: string;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export default function Button(props: ButtonAsLink | ButtonAsButton) {
  const { variant = "primary", size = "md", className, loading, children } = props;
  const classes = clsx(base, variants[variant], sizes[size], className);

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { href: _href, variant: _v, size: _s, className: _c, loading: _l, children: _ch, ...rest } = props as ButtonAsButton;
  return (
    <button type="button" className={classes} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
