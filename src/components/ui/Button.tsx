import { clsx } from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "ios-press inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-teal-500 text-navy-950 shadow-[0_1px_2px_rgba(13,143,131,0.35),0_6px_16px_rgba(20,179,163,0.28)] hover:bg-teal-400 active:bg-teal-600",
  secondary: "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950",
  outline: "border border-navy-900/25 bg-white/60 text-navy-900 backdrop-blur hover:bg-navy-900 hover:text-white",
  ghost: "text-navy-900 hover:bg-surface-100",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 py-2.5 text-[15px]",
  lg: "min-h-[52px] px-8 py-3.5 text-[17px]",
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
