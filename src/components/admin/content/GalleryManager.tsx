"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { GalleryItemContent } from "@/lib/server/content";
import ImageUploadField from "./ImageUploadField";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import BulkDeleteBar from "@/components/admin/ui/BulkDeleteBar";
import { useToast } from "@/components/admin/ui/Toast";
import { useBulkSelect } from "@/lib/admin/useBulkSelect";

function Row({ item, onDeleted, checked, onToggle }: { item: GalleryItemContent; onDeleted: (id: string) => void; checked: boolean; onToggle: () => void }) {
  const [form, setForm] = useState({
    imageUrl: item.imageUrl,
    altText: item.altText,
    caption: item.caption || "",
    serviceType: item.serviceType || "",
    category: item.category || "",
    isPublished: item.isPublished,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(patch: Partial<typeof form>) {
    setSaving(true);
    await fetch(`/api/admin/gallery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }

  async function remove() {
    setDeleting(true);
    await fetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" });
    onDeleted(item.id);
  }

  return (
    <div className="flex gap-2.5 rounded-2xl border border-admin-border bg-admin-card p-4">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select image: ${item.altText}`} className="mt-2" />
      <div className="flex-1">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ImageUploadField
          label="Image"
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          onCommit={(url) => save({ imageUrl: url })}
        />
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Alt text</span>
          <input
            value={form.altText}
            onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
            onBlur={() => save({ altText: form.altText })}
            className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Caption</span>
          <input
            value={form.caption}
            onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
            onBlur={() => save({ caption: form.caption })}
            className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Service type</span>
          <input
            value={form.serviceType}
            onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
            onBlur={() => save({ serviceType: form.serviceType })}
            className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Category (kitchen/bathroom/living/hallway/laundry/team)</span>
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            onBlur={() => save({ category: form.category })}
            className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-admin-text">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => {
              setForm((f) => ({ ...f, isPublished: e.target.checked }));
              save({ isPublished: e.target.checked });
            }}
          />
          Published
        </label>
        <div className="flex items-center gap-2 text-xs text-admin-text-muted">
          {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          <button type="button" onClick={remove} disabled={deleting} aria-label="Delete image" className="ios-press flex size-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function GalleryManager({ initialItems }: { initialItems: GalleryItemContent[] }) {
  const { showToast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newAltText, setNewAltText] = useState("");
  const [creating, setCreating] = useState(false);
  const bulk = useBulkSelect(items.map((i) => i.id));
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  async function deleteSelected() {
    setBulkDeleting(true);
    const res = await fetch("/api/admin/gallery/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...bulk.selected] }),
    });
    const data = await res.json().catch(() => null);
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    if (!data?.ok) return showToast("Couldn't delete the selected images", "error");
    setItems((prev) => prev.filter((i) => !bulk.selected.has(i.id)));
    showToast(`Deleted ${data.deleted} image${data.deleted === 1 ? "" : "s"}.`, "success");
    bulk.clear();
  }

  async function addItem() {
    if (!newImageUrl.trim() || !newAltText.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: newImageUrl, altText: newAltText, sortOrder: items.length }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.ok) {
      setItems((prev) => [
        ...prev,
        { id: json.id, imageUrl: newImageUrl, altText: newAltText, caption: null, serviceType: null, category: null, isPublished: true, sortOrder: prev.length },
      ]);
      setNewImageUrl("");
      setNewAltText("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-admin-border p-4">
        <p className="text-sm font-semibold text-admin-text">Add a gallery image</p>
        <div className="mt-2">
          <ImageUploadField label="Image" value={newImageUrl} onChange={setNewImageUrl} />
        </div>
        <input
          placeholder="Alt text"
          value={newAltText}
          onChange={(e) => setNewAltText(e.target.value)}
          className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
        />
        <button type="button" onClick={addItem} disabled={creating} className="ios-press mt-2 inline-flex items-center gap-1.5 rounded-full bg-admin-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          <Plus className="size-4" aria-hidden /> Add image
        </button>
      </div>

      <BulkDeleteBar count={bulk.selected.size} itemLabel="image" onDelete={() => setConfirmBulkDelete(true)} onClear={bulk.clear} busy={bulkDeleting} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Row key={item.id} item={item} onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} checked={bulk.selected.has(item.id)} onToggle={() => bulk.toggle(item.id)} />
        ))}
      </div>

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${bulk.selected.size} image${bulk.selected.size === 1 ? "" : "s"}?`}
        description="This can't be undone."
        confirmLabel={bulkDeleting ? "Deleting…" : "Delete"}
        tone="danger"
        onConfirm={deleteSelected}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
