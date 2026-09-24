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
    <section id={id} aria-labelledby={ariaLabelledby} className={clsx("public-section py-12 sm:py-16", className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">{children}</p>
  );
}
