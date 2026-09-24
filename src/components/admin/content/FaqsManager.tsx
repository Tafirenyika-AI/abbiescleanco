"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { FaqItem } from "@/lib/server/content";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import BulkDeleteBar from "@/components/admin/ui/BulkDeleteBar";
import { useToast } from "@/components/admin/ui/Toast";
import { useBulkSelect } from "@/lib/admin/useBulkSelect";

function Row({ faq, onDeleted, checked, onToggle }: { faq: FaqItem; onDeleted: (id: string) => void; checked: boolean; onToggle: () => void }) {
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [isActive, setIsActive] = useState(faq.isActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(patch: Partial<{ question: string; answer: string; isActive: boolean }>) {
    setSaving(true);
    await fetch(`/api/admin/faqs/${faq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }

  async function remove() {
    setDeleting(true);
    await fetch(`/api/admin/faqs/${faq.id}`, { method: "DELETE" });
    onDeleted(faq.id);
  }

  return (
    <div className="flex gap-2.5 rounded-2xl border border-admin-border bg-admin-card p-4">
      <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select FAQ: ${faq.question}`} className="mt-2" />
      <div className="flex-1">
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">Question</span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onBlur={() => save({ question })}
          className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm font-medium"
        />
      </label>
      <label className="mt-2 block">
        <span className="text-xs font-medium text-admin-text-muted">Answer</span>
        <textarea
          rows={2}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onBlur={() => save({ answer })}
          className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
        />
      </label>
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-admin-text">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.target.checked);
              save({ isActive: e.target.checked });
            }}
          />
          Published
        </label>
        <div className="flex items-center gap-2 text-xs text-admin-text-muted">
          {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          <button type="button" onClick={remove} disabled={deleting} aria-label="Delete FAQ" className="ios-press flex size-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function FaqsManager({ initialFaqs }: { initialFaqs: FaqItem[] }) {
  const { showToast } = useToast();
  const [faqs, setFaqs] = useState(initialFaqs);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [creating, setCreating] = useState(false);
  const bulk = useBulkSelect(faqs.map((f) => f.id));
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  async function deleteSelected() {
    setBulkDeleting(true);
    const res = await fetch("/api/admin/faqs/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...bulk.selected] }),
    });
    const data = await res.json().catch(() => null);
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    if (!data?.ok) return showToast("Couldn't delete the selected FAQs", "error");
    setFaqs((prev) => prev.filter((f) => !bulk.selected.has(f.id)));
    showToast(`Deleted ${data.deleted} FAQ${data.deleted === 1 ? "" : "s"}.`, "success");
    bulk.clear();
  }

  async function addFaq() {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion, answer: newAnswer, sortOrder: faqs.length }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.ok) {
      setFaqs((prev) => [...prev, { id: json.id, question: newQuestion, answer: newAnswer, sortOrder: prev.length, isActive: true }]);
      setNewQuestion("");
      setNewAnswer("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-admin-border p-4">
        <p className="text-sm font-semibold text-admin-text">Add a new FAQ</p>
        <input
          placeholder="Question"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
        />
        <textarea
          placeholder="Answer"
          rows={2}
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
          className="mt-2 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
        />
        <button type="button" onClick={addFaq} disabled={creating} className="ios-press mt-2 inline-flex items-center gap-1.5 rounded-full bg-admin-navy px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          <Plus className="size-4" aria-hidden /> Add FAQ
        </button>
      </div>

      <BulkDeleteBar count={bulk.selected.size} itemLabel="FAQ" onDelete={() => setConfirmBulkDelete(true)} onClear={bulk.clear} busy={bulkDeleting} />

      {faqs.map((f) => (
        <Row key={f.id} faq={f} onDeleted={(id) => setFaqs((prev) => prev.filter((x) => x.id !== id))} checked={bulk.selected.has(f.id)} onToggle={() => bulk.toggle(f.id)} />
      ))}

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${bulk.selected.size} FAQ${bulk.selected.size === 1 ? "" : "s"}?`}
        description="This can't be undone."
        confirmLabel={bulkDeleting ? "Deleting…" : "Delete"}
        tone="danger"
        onConfirm={deleteSelected}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  );
}
