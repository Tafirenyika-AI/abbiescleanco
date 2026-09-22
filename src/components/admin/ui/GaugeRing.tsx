/** SVG ring gauge for a 0-100 score, e.g. quote conversion rate. */
export default function GaugeRing({ value, label, size = 116 }: { value: number; label: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const tone = clamped >= 50 ? "var(--color-admin-teal)" : clamped >= 25 ? "var(--color-admin-warning)" : "var(--color-admin-error)";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(clamped)}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-admin-bg)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-admin-text text-2xl font-semibold">
          {Math.round(clamped)}%
        </text>
      </svg>
      <p className="mt-2 text-sm font-medium text-admin-text-muted">{label}</p>
    </div>
  );
}
