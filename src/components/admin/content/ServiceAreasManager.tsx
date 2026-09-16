"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { ServiceAreaContent } from "@/lib/server/content";

function Row({ area, onDeleted }: { area: ServiceAreaContent; onDeleted: (id: string) => void }) {
  const [name, setName] = useState(area.name);
  const [zipCode, setZipCode] = useState(area.zipCode || "");
  const [isActive, setIsActive] = useState(area.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(patch: Partial<{ name: string; zipCode: string; isActive: boolean }>) {
    setSaving(true);
    await fetch(`/api/admin/service-areas/${area.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }

  async function remove() {
    setDeleting(true);
    await fetch(`/api/admin/service-areas/${area.id}`, { method: "DELETE" });
    onDeleted(area.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-admin-border bg-admin-card p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save({ name })}
        className="w-40 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
      />
      <input
        placeholder="ZIP (optional)"
        value={zipCode}
        onChange={(e) => setZipCode(e.target.value)}
        onBlur={() => save({ zipCode })}
        className="w-28 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
      />
      <label className="flex items-center gap-1.5 text-sm text-admin-text">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => {
            setIsActive(e.target.checked);
            save({ isActive: e.target.checked });
          }}
        />
        Active
      </label>
      {saving && <Loader2 className="size-3.5 animate-spin text-admin-text-muted" aria-hidden />}
      <button type="button" onClick={remove} disabled={deleting} aria-label="Delete area" className="ml-auto flex size-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export default function ServiceAreasManager({ initialAreas }: { initialAreas: ServiceAreaContent[] }) {
  const [areas, setAreas] = useState(initialAreas);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function addArea() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/service-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.ok) {
      setAreas((prev) => [...prev, { id: json.id, name: newName, zipCode: null, isActive: true }]);
      setNewName("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-admin-border p-3">
        <input
          placeholder="New area name, e.g. Millwood"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
        />
        <button type="button" onClick={addArea} disabled={creating} className="inline-flex items-center gap-1.5 rounded-full bg-admin-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </div>

      {areas.map((a) => (
        <Row key={a.id} area={a} onDeleted={(id) => setAreas((prev) => prev.filter((x) => x.id !== id))} />
      ))}
    </div>
  );
}
