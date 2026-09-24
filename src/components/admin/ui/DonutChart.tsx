const COLORS = ["#0d8f83", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444", "#10b981", "#6366f1", "#64748b"];

/** Small donut chart for a real category breakdown (e.g. expenses by category). Segments are
 *  plain SVG arcs, no charting library -- consistent with this app's other hand-rolled charts. */
export default function DonutChart({ data, formatValue }: { data: { label: string; cents: number }[]; formatValue: (v: number) => string }) {
  const total = data.reduce((s, d) => s + d.cents, 0);
  if (total <= 0 || data.length === 0) {
    return <p className="py-8 text-center text-sm text-admin-text-muted">No data in this window yet.</p>;
  }

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashes = data.map((d) => (d.cents / total) * circumference);
  const segments = data.map((d, i) => ({
    ...d,
    color: COLORS[i % COLORS.length],
    dash: dashes[i],
    gap: circumference - dashes[i],
    offset: dashes.slice(0, i).reduce((sum, v) => sum + v, 0),
  }));

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90">
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth="16"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {segments.slice(0, 8).map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-admin-text-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 font-medium text-admin-text">{formatValue(s.cents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
