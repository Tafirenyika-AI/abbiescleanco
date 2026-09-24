"use client";

import { useState } from "react";
import { Plus, Megaphone, Loader2, Pencil, Trash2 } from "lucide-react";
import type { PromoCodeItem, DiscountType } from "@/lib/server/promoCodeStore";
import Card from "@/components/admin/ui/Card";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate } from "@/lib/adminDate";

/** dollars in the UI, cents everywhere in the DB/API — same convention as every other money field in this app. */
function toStoredValue(discountType: DiscountType, displayValue: number): number {
  return discountType === "FIXED" ? Math.round(displayValue * 100) : Math.round(displayValue);
}
function toDisplayValue(discountType: DiscountType, storedValue: number): number {
  return discountType === "FIXED" ? storedValue / 100 : storedValue;
}

export default function PromotionsManager({ promoCodes: initialPromoCodes }: { promoCodes: PromoCodeItem[] }) {
  const { showToast } = useToast();
  const [promoCodes, setPromoCodes] = useState(initialPromoCodes);
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<DiscountType>("PERCENT");
  const [editDiscountValue, setEditDiscountValue] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editMaxRedemptions, setEditMaxRedemptions] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function submit() {
    if (!code || !discountValue) return;
    setSaving(true);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        description: description || undefined,
        discountType,
        discountValue: toStoredValue(discountType, Number(discountValue)),
        expiresAt: expiresAt || undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok || !json.ok) {
      showToast(json.error || "Couldn't create promo code", "error");
      return;
    }
    showToast("Promo code created", "success");
    setFormOpen(false);
    setCode("");
    setDescription("");
    setDiscountValue("");
    setExpiresAt("");
    setMaxRedemptions("");
    window.location.reload();
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      showToast("Couldn't update promo code", "error");
      return;
    }
    setPromoCodes((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)));
    showToast(active ? "Activated" : "Deactivated", "success");
  }

  function startEdit(p: PromoCodeItem) {
    setEditingId(p.id);
    setEditDescription(p.description ?? "");
    setEditDiscountType(p.discountType);
    setEditDiscountValue(String(toDisplayValue(p.discountType, p.discountValue)));
    setEditExpiresAt(p.expiresAt ? p.expiresAt.slice(0, 10) : "");
    setEditMaxRedemptions(p.maxRedemptions ? String(p.maxRedemptions) : "");
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    const res = await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editDescription || "",
        discountType: editDiscountType,
        discountValue: toStoredValue(editDiscountType, Number(editDiscountValue)),
        expiresAt: editExpiresAt || null,
        maxRedemptions: editMaxRedemptions ? Number(editMaxRedemptions) : null,
      }),
    });
    const json = await res.json();
    setSavingEdit(false);
    if (!res.ok || !json.ok) {
      showToast(json.error || "Couldn't save changes", "error");
      return;
    }
    showToast("Promo code updated", "success");
    setEditingId(null);
    window.location.reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    const res = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't delete promo code", "error");
      return;
    }
    setPromoCodes((prev) => prev.filter((p) => p.id !== id));
    showToast("Promo code deleted", "success");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Promotions</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            {promoCodes.length} code{promoCodes.length === 1 ? "" : "s"}, customers can enter one on the estimate form; apply it when you build their quote.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover"
        >
          <Plus className="size-4" aria-hidden /> New promo code
        </button>
      </div>

      {formOpen && (
        <Card className="mt-4">
          <h2 className="font-semibold text-admin-text">New promo code</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SPRING10"
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm font-mono text-admin-text"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Description (internal)</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Spring promo, 10% off"
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Discount type</span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              >
                <option value="PERCENT">Percent off</option>
                <option value="FIXED">Fixed amount off ($)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">
                {discountType === "PERCENT" ? "Percent off (1-100)" : "Amount off ($)"}
              </span>
              <input
                type="number"
                min="1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Expires (optional)</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Max redemptions (optional)</span>
              <input
                type="number"
                min="1"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!code || !discountValue || saving}
            className="ios-press mt-3 flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Create
          </button>
        </Card>
      )}

      <div className="mt-4 admin-table-surface overflow-x-auto rounded-2xl border border-admin-border bg-admin-card">
        {promoCodes.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No promo codes yet"
            description="Create a code and share it with customers, they can enter it on the estimate form."
          />
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-admin-bg">
              <tr>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Code</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Description</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Discount</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Redeemed</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Expires</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Active</th>
                <th scope="col" className="p-3.5 font-semibold text-admin-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((p) =>
                editingId === p.id ? (
                  <tr key={p.id} className="border-t border-admin-border bg-admin-bg">
                    <td className="p-3.5 font-mono text-admin-text">{p.code}</td>
                    <td className="p-3.5" colSpan={5}>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                          className="rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                        />
                        <select
                          value={editDiscountType}
                          onChange={(e) => setEditDiscountType(e.target.value as DiscountType)}
                          className="rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                        >
                          <option value="PERCENT">Percent off</option>
                          <option value="FIXED">Fixed ($) off</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={editDiscountValue}
                          onChange={(e) => setEditDiscountValue(e.target.value)}
                          placeholder={editDiscountType === "PERCENT" ? "% off" : "$ off"}
                          className="rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                        />
                        <input
                          type="date"
                          value={editExpiresAt}
                          onChange={(e) => setEditExpiresAt(e.target.value)}
                          className="rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={editMaxRedemptions}
                          onChange={(e) => setEditMaxRedemptions(e.target.value)}
                          placeholder="Max redemptions (optional)"
                          className="w-48 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(p.id)}
                          disabled={savingEdit}
                          className="flex items-center gap-1.5 rounded-lg bg-admin-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
                        >
                          {savingEdit ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-admin-border px-3 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-t border-admin-border">
                    <td className="p-3.5 font-mono text-admin-text">{p.code}</td>
                    <td className="p-3.5 text-admin-text-muted">{p.description ?? "—"}</td>
                    <td className="p-3.5 text-admin-text">
                      {p.discountType === "PERCENT" ? `${p.discountValue}%` : `$${(p.discountValue / 100).toFixed(2)}`}
                    </td>
                    <td className="p-3.5 text-admin-text-muted">
                      {p.redemptionCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                    </td>
                    <td className="p-3.5 text-admin-text-muted">{p.expiresAt ? formatDate(p.expiresAt) : "—"}</td>
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => toggleActive(p.id, !p.active)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.active ? "bg-admin-success/10 text-admin-success" : "bg-admin-bg text-admin-text-muted"
                        }`}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          aria-label="Edit promo code"
                          className="flex size-8 items-center justify-center rounded-lg text-admin-text-muted hover:bg-admin-bg hover:text-admin-text"
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p.id)}
                          aria-label="Delete promo code"
                          className="flex size-8 items-center justify-center rounded-lg text-admin-text-muted hover:bg-red-50 hover:text-admin-error"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this promo code?"
        description="Quotes that already used it keep their discount, this just removes the code so it can't be used again."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
