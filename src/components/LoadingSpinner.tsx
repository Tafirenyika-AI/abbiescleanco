/**
 * The app's one branded loading indicator -- the logo held still in the center, surrounded by a
 * spinning multi-color ring. Used for route-level loading states (loading.tsx in each of the
 * three root layouts) and any other "the system is fetching something real" moment. Small inline
 * spinners (a button mid-save, a 16px icon) stay plain Loader2 from lucide-react -- a logo can't
 * read at that size, so this component starts at "sm" (32px) and up.
 */

const RING_GRADIENT = "conic-gradient(from 0deg, #0d8f83, #22d3ee, #f59e0b, #ec4899, #7c3aed, #0d8f83)";

const SIZES = {
  sm: { box: 32, ring: 4, logo: 18 },
  md: { box: 56, ring: 5, logo: 32 },
  lg: { box: 96, ring: 7, logo: 56 },
} as const;

export default function LoadingSpinner({ size = "md", logoUrl = "/images/logo.png", label }: { size?: keyof typeof SIZES; logoUrl?: string; label?: string }) {
  const { box, ring, logo } = SIZES[size];
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="relative" style={{ width: box, height: box }}>
        <div className="absolute inset-0 animate-spin rounded-full" style={{ background: RING_GRADIENT }} />
        <div className="absolute rounded-full bg-white" style={{ inset: ring }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          className="absolute inset-0 m-auto rounded-full object-contain"
          style={{ width: logo, height: logo }}
        />
      </div>
      {label && <p className="text-sm text-surface-700">{label}</p>}
      <span className="sr-only">Loading{label ? `: ${label}` : "…"}</span>
    </div>
  );
}

/** Fills the viewport -- for route-level loading.tsx files. */
export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}
