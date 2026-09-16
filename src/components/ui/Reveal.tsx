"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";

/**
 * Scroll-triggered fade/slide-in wrapper. Reveals once — no distracting
 * re-animation on scroll-back. Doesn't special-case prefers-reduced-motion
 * itself: the global CSS override in globals.css already collapses every
 * transition-duration to ~0ms for that preference, so content still
 * reveals on scroll, just without the animated motion.
 */
export default function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
      className={clsx(
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
