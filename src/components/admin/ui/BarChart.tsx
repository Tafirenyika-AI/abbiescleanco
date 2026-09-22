/** Small bar chart for a short real series -- e.g. daily revenue. Values in chronological order. */
export default function BarChart({ data, formatValue }: { data: { label: string; value: number }[]; formatValue: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <p className="text-2xl font-semibold text-admin-text">{formatValue(total)}</p>
      <div className="mt-4 flex h-28 items-end gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="group relative flex-1">
            <div
              className={`w-full rounded-t-sm transition-colors ${d.value > 0 ? "bg-admin-teal group-hover:bg-admin-teal-hover" : "bg-admin-bg"}`}
              style={{ height: `${Math.max(4, (d.value / max) * 112)}px` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-admin-navy px-2 py-1 text-[11px] font-medium text-white group-hover:block">
              {d.label}: {formatValue(d.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-admin-text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
