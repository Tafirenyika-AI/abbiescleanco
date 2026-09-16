import { clsx } from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-teal-500 text-navy-950 hover:bg-teal-400 active:bg-teal-600",
  secondary: "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950",
  outline: "border-2 border-navy-900 text-navy-900 hover:bg-navy-900 hover:text-white",
  ghost: "text-navy-900 hover:bg-surface-100",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-7 py-3.5 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonAsLink = CommonProps & {
  href: string;
  external?: boolean;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export default function Button(props: ButtonAsLink | ButtonAsButton) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = clsx(base, variants[variant], sizes[size], className);

  if ("href" in props && props.href) {
    const { href, external } = props;
    if (external) {
      return (
        <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as ButtonAsButton;

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
