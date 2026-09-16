import { clsx } from "clsx";
import type { ReactNode } from "react";
import Container from "./Container";

export default function Section({
  children,
  className,
  containerClassName,
  id,
  ariaLabelledby,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
  ariaLabelledby?: string;
}) {
  return (
    <section id={id} aria-labelledby={ariaLabelledby} className={clsx("py-16 sm:py-20", className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">{children}</p>
  );
}
