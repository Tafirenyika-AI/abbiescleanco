"use client";

import { Loader2, Trash2, X } from "lucide-react";

/** The "N selected -> Delete / Clear" toolbar shown above a list once at least one row is
 *  checked. Shared across every admin list that supports bulk delete, so the pattern (and its
 *  styling) stays identical everywhere rather than being re-implemented per list. */
export default function BulkDeleteBar({ count, itemLabel, onDelete, onClear, busy }: { count: number; itemLabel: string; onDelete: () => void; onClear: () => void; busy?: boolean }) {
  if (count === 0) return null;
  return (
    <div className="ios-sheet-in flex items-center justify-between rounded-lg bg-admin-teal/10 px-3.5 py-2.5 text-sm text-admin-text">
      <span className="font-semibold">
        {count} {itemLabel}
        {count === 1 ? "" : "s"} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="ios-press inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />} Delete selected
        </button>
        <button type="button" onClick={onClear} aria-label="Clear selection" className="ios-press rounded-full p-1.5 text-admin-text-muted hover:bg-admin-bg">
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
