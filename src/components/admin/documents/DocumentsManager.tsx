"use client";

import { useState } from "react";
import { Plus, X, Loader2, Trash2, Upload, FileText, AlertTriangle, Download } from "lucide-react";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate } from "@/lib/adminDate";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  documentCategoryLabels,
  documentStatusLabels,
  isPastExpiration,
  type DocumentRow,
  type DocumentCategoryValue,
  type DocumentStatusValue,
} from "@/lib/documents";

function statusTone(status: DocumentStatusValue): "neutral" | "success" | "warning" | "error" | "info" {
  if (status === "ACTIVE") return "success";
  if (status === "EXPIRED" || status === "TERMINATED") return "error";
  return "neutral";
}

export default function DocumentsManager({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategoryValue | "">("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatusValue | "">("");
  const [search, setSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const filtered = documents.filter((d) => {
    if (categoryFilter && d.category !== categoryFilter) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !(d.reference || "").toLowerCase().includes(q) && !(d.counterpartyName || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-admin-text">Documents</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            Agreements, insurance, licenses, receipts, statements, and any correspondence worth keeping a record of. Reference numbers can be typed in yourself or generated automatically, and are always editable.
          </p>
        </div>
        <button type="button" onClick={() => setShowNewForm(true)} className="ios-press inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
          <Plus className="size-4" aria-hidden /> New document
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as DocumentCategoryValue | "")} className="rounded-lg border border-admin-border bg-admin-card px-3 py-1.5 text-sm text-admin-text">
          <option value="">All categories</option>
          {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{documentCategoryLabels[c]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DocumentStatusValue | "")} className="rounded-lg border border-admin-border bg-admin-card px-3 py-1.5 text-sm text-admin-text">
          <option value="">All statuses</option>
          {DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{documentStatusLabels[s]}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, reference, or counterparty"
          className="min-w-56 flex-1 rounded-lg border border-admin-border bg-admin-card px-3 py-1.5 text-sm text-admin-text"
        />
        <span className="text-xs text-admin-text-muted">{filtered.length} document{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Add an agreement, insurance cert, license, receipt, or any other business paperwork." />
      ) : (
        <div className="admin-table-surface overflow-hidden rounded-xl border border-admin-border bg-admin-card">
          <table className="w-full text-sm">
            <thead className="bg-admin-bg text-left text-xs font-semibold uppercase text-admin-text-muted">
              <tr>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Reference</th>
                <th className="px-4 py-2.5">Counterparty</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Expires</th>
                <th className="px-4 py-2.5">Files</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const expired = isPastExpiration(d);
                return (
                  <tr key={d.id} onClick={() => setSelected(d)} className="cursor-pointer border-t border-admin-border transition-colors duration-150 hover:bg-admin-bg">
                    <td className="px-4 py-2.5 font-medium text-admin-text">{d.title}</td>
                    <td className="px-4 py-2.5 text-admin-text-muted">{documentCategoryLabels[d.category]}</td>
                    <td className="px-4 py-2.5 text-admin-text-muted">{d.reference || "—"}</td>
                    <td className="px-4 py-2.5 text-admin-text-muted">{d.counterpartyName || "—"}</td>
                    <td className="px-4 py-2.5"><Badge tone={statusTone(d.status)}>{documentStatusLabels[d.status]}</Badge></td>
                    <td className="px-4 py-2.5 text-admin-text-muted">
                      {d.expirationDate ? (
                        <span className={expired ? "flex items-center gap-1 font-medium text-red-600" : ""}>
                          {expired && <AlertTriangle className="size-3.5" aria-hidden />} {formatDate(d.expirationDate)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-admin-text-muted">{d.files.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNewForm && (
        <NewDocumentModal
          onClose={() => setShowNewForm(false)}
          onCreated={(doc) => {
            setDocuments((prev) => [doc, ...prev]);
            setShowNewForm(false);
            setSelected(doc);
          }}
        />
      )}

      {selected && (
        <DocumentDrawer
          document={selected}
          onClose={() => setSelected(null)}
          onUpdated={(d) => {
            setSelected(d);
            setDocuments((prev) => prev.map((x) => (x.id === d.id ? d : x)));
          }}
          onDeleted={(id) => {
            setSelected(null);
            setDocuments((prev) => prev.filter((x) => x.id !== id));
          }}
        />
      )}
    </div>
  );
}

function NewDocumentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: DocumentRow) => void }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategoryValue>("AGREEMENT");
  const [reference, setReference] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, reference: reference.trim() || null, counterpartyName: counterpartyName.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't create document", "error");
    showToast("Document created.", "success");
    onCreated(data.document);
  }

  return (
    <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-admin-text">New document</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-admin-text-muted">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="Vendor agreement -- SDI Cleaning Supplies" />
          </div>
          <div>
            <label className="text-xs font-semibold text-admin-text-muted">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategoryValue)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
              {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{documentCategoryLabels[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-admin-text-muted">Reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="Leave blank to auto-generate, e.g. ACM-AGR-2026-001" />
          </div>
          <div>
            <label className="text-xs font-semibold text-admin-text-muted">Counterparty (optional)</label>
            <input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" placeholder="Who this is with" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
          <button type="button" disabled={saving || !title.trim()} onClick={create} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentDrawer({ document, onClose, onUpdated, onDeleted }: { document: DocumentRow; onClose: () => void; onUpdated: (d: DocumentRow) => void; onDeleted: (id: string) => void }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(document.title);
  const [category, setCategory] = useState(document.category);
  const [status, setStatus] = useState(document.status);
  const [reference, setReference] = useState(document.reference || "");
  const [counterpartyName, setCounterpartyName] = useState(document.counterpartyName || "");
  const [effectiveDate, setEffectiveDate] = useState(document.effectiveDate ? document.effectiveDate.slice(0, 10) : "");
  const [expirationDate, setExpirationDate] = useState(document.expirationDate ? document.expirationDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(document.notes || "");
  const [correspondenceLog, setCorrespondenceLog] = useState(document.correspondenceLog || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function save() {
    setBusy("save");
    const res = await fetch(`/api/admin/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, category, status,
        reference: reference.trim() || null,
        counterpartyName: counterpartyName.trim() || null,
        effectiveDate: effectiveDate || null,
        expirationDate: expirationDate || null,
        notes: notes || null,
        correspondenceLog: correspondenceLog || null,
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!data?.ok) return showToast(data?.error || "Couldn't save", "error");
    onUpdated(data.document);
    showToast("Saved.", "success");
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/documents/${document.id}/files`, { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    setUploading(false);
    if (!data?.ok) return showToast(data?.error || "Upload failed", "error");
    const refreshed = await fetch(`/api/admin/documents/${document.id}`).then((r) => r.json());
    if (refreshed?.ok) onUpdated(refreshed.document);
    showToast("File attached.", "success");
  }

  async function deleteFile(fileRowId: string) {
    setBusy(fileRowId);
    await fetch(`/api/admin/documents/${document.id}/files/${fileRowId}`, { method: "DELETE" });
    setBusy(null);
    onUpdated({ ...document, files: document.files.filter((f) => f.id !== fileRowId) });
  }

  async function deleteDocument() {
    setBusy("delete");
    const res = await fetch(`/api/admin/documents/${document.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setBusy(null);
    setConfirmDelete(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't remove this document", "error");
    onDeleted(document.id);
    showToast("Document removed.", "success");
  }

  return (
    <div className="ios-backdrop-in fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-drawer-in h-full w-full max-w-lg overflow-y-auto bg-admin-card p-6 shadow-[-8px_0_40px_rgba(15,23,42,0.12)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-admin-text-muted">{documentCategoryLabels[category]}</p>
            <h2 className="text-lg font-semibold text-admin-text">{document.title}</h2>
            <Badge tone={statusTone(status)} className="mt-1">{documentStatusLabels[status]}</Badge>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ios-press rounded-lg p-1.5 text-admin-text-muted hover:bg-admin-bg"><X className="size-5" aria-hidden /></button>
        </div>

        <div className="mt-4 space-y-2.5 text-sm">
          <label className="block">
            <span className="text-xs text-admin-text-muted">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-admin-text-muted">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategoryValue)} className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text">
                {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{documentCategoryLabels[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-admin-text-muted">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as DocumentStatusValue)} className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text">
                {DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{documentStatusLabels[s]}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-admin-text-muted">Reference</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. ACM-SDI-2026-001" className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text" />
          </label>
          <label className="block">
            <span className="text-xs text-admin-text-muted">Counterparty</span>
            <input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-admin-text-muted">Effective date</span>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs text-admin-text-muted">Expiration date</span>
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="mt-0.5 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Notes</h3>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Terms, scope, anything worth remembering" className="mt-1.5 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text" />
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Correspondence log</h3>
          <p className="mt-1 text-xs text-admin-text-muted">Paste relevant email text here, or attach the actual .eml/PDF/screenshot below.</p>
          <textarea value={correspondenceLog} onChange={(e) => setCorrespondenceLog(e.target.value)} rows={5} placeholder="Paste email thread text here..." className="mt-1.5 w-full rounded-lg border border-admin-border bg-admin-bg px-3 py-2 text-sm text-admin-text" />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Files</h3>
            <label className="ios-press inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-admin-bg px-3 py-1.5 text-xs font-semibold text-admin-text">
              {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />} Upload
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.eml,.png,.jpg,.jpeg,.webp,.gif"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {document.files.length === 0 ? (
            <p className="mt-2 text-xs text-admin-text-muted">No files attached yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {document.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-admin-bg px-3 py-2 text-xs">
                  <a href={`/api/admin/documents/files/${f.fileId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-admin-text hover:underline">
                    <Download className="size-3.5 shrink-0" aria-hidden /> {f.filename}
                  </a>
                  <button type="button" disabled={busy === f.id} onClick={() => deleteFile(f.id)} className="ios-press rounded-full p-1 text-admin-text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={!!busy} className="ios-press rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} disabled={!!busy} className="ios-press inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-admin-text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
            <Trash2 className="size-4" aria-hidden /> Remove
          </button>
        </div>

        {document.createdByName && <p className="mt-4 text-xs text-admin-text-muted">Created by {document.createdByName}</p>}

        <ConfirmDialog
          open={confirmDelete}
          title="Remove this document?"
          description="This removes the record and its attachments list. The underlying files stay in storage but won't be reachable from here anymore."
          confirmLabel={busy === "delete" ? "Removing…" : "Remove"}
          tone="danger"
          onConfirm={deleteDocument}
          onCancel={() => setConfirmDelete(false)}
        />
      </div>
    </div>
  );
}
