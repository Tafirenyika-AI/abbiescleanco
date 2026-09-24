/** Two-series bar chart (e.g. revenue vs expenses) -- paired bars per point, real data only. */
export default function DualBarChart({
  data,
  formatValue,
  aLabel,
  bLabel,
}: {
  data: { label: string; a: number; b: number }[];
  formatValue: (v: number) => string;
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)));

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-admin-text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-admin-teal" /> {aLabel}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" /> {bLabel}</span>
      </div>
      <div className="mt-3 flex h-28 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="group relative flex flex-1 items-end gap-0.5">
            <div className="flex-1 rounded-t-sm bg-admin-teal transition-colors group-hover:bg-admin-teal-hover" style={{ height: `${Math.max(2, (d.a / max) * 112)}px` }} />
            <div className="flex-1 rounded-t-sm bg-amber-400 transition-colors group-hover:bg-amber-500" style={{ height: `${Math.max(2, (d.b / max) * 112)}px` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-admin-navy px-2 py-1 text-[11px] font-medium text-white group-hover:block">
              {d.label}: {formatValue(d.a)} / {formatValue(d.b)}
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
