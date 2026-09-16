"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Uses the native <dialog> element: free focus trapping, Escape-to-close,
 * and a ::backdrop, rather than reimplementing that by hand.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-full max-w-sm rounded-2xl border border-admin-border bg-admin-card p-6 shadow-2xl backdrop:bg-slate-950/50"
    >
      <h2 className="text-base font-semibold text-admin-text">{title}</h2>
      {description && <p className="mt-2 text-sm text-admin-text-muted">{description}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={
            tone === "danger"
              ? "rounded-lg bg-admin-error px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              : "rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover"
          }
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>,
    document.body
  );
}
