/** Tiny inline trend line for a KPI card -- values in chronological order, all zero renders a flat mid-line rather than nothing. */
export default function Sparkline({ values, className = "text-admin-teal" }: { values: number[]; className?: string }) {
  const w = 72;
  const h = 24;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className={className}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
