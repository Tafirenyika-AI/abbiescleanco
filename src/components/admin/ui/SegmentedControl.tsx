"use client";

/**
 * A small set of mutually-exclusive options shown as real buttons (not concatenated plain text),
 * reusing the existing `.ios-segment`/`.ios-segment-item` pattern already proven on the public site
 * (services filter, gallery, account dashboard) rather than inventing a second control style.
 * role="radiogroup"/"radio" (not tablist/tab) since this is a form field value, not a view filter --
 * real <button> elements mean Tab/Enter/Space keyboard activation and screen-reader semantics come
 * for free, no custom key handling needed.
 */
export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-admin-text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="ios-segment mt-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className="ios-segment-item disabled:cursor-not-allowed disabled:opacity-60"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
