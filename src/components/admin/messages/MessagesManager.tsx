"use client";

import { useMemo, useState } from "react";
import { Mail, Trash2, AlertTriangle } from "lucide-react";
import type { ContactMessageItem, ContactMessageStatusValue } from "@/lib/server/contactMessageStore";
import { CONTACT_MESSAGE_STATUSES } from "@/lib/server/contactMessageStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDateTime } from "@/lib/adminDate";

const statusTone: Record<ContactMessageStatusValue, "neutral" | "info" | "success" | "error" | "warning"> = {
  NEW: "info",
  READ: "neutral",
  RESPONDED: "success",
  ARCHIVED: "neutral",
};

const filters: { key: ContactMessageStatusValue | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "NEW", label: "New" },
  { key: "READ", label: "Read" },
  { key: "RESPONDED", label: "Responded" },
  { key: "ARCHIVED", label: "Archived" },
];

export default function MessagesManager({ messages: initialMessages }: { messages: ContactMessageItem[] }) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [active, setActive] = useState<(typeof filters)[number]["key"]>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = useMemo(
    () => (active === "all" ? messages : messages.filter((m) => m.status === active)),
    [active, messages]
  );

  async function changeStatus(id: string, status: ContactMessageStatusValue) {
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      showToast("Couldn't update message", "error");
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    const res = await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Couldn't delete message", "error");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    showToast("Message deleted", "success");
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Messages</h1>
        <p className="mt-1 text-sm text-admin-text-muted">Every submission through the site&apos;s Contact form, nothing here depends on you seeing the email.</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-full border border-admin-border bg-admin-card p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActive(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active === f.key ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <Card><EmptyState icon={Mail} title="No messages" description="Contact form submissions will show up here." /></Card>
        ) : (
          filtered.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-admin-text">{m.name}</p>
                    {m.isUrgent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-admin-error">
                        <AlertTriangle className="size-3" aria-hidden /> Urgent
                      </span>
                    )}
                    <Badge tone={statusTone[m.status]}>{m.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-admin-text-muted">
                    <a href={`mailto:${m.email}`} className="hover:underline">{m.email}</a>
                    {m.phone && <> · <a href={`tel:${m.phone}`} className="hover:underline">{m.phone}</a></>}
                    {" · "}{formatDateTime(m.createdAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-admin-text">{m.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    aria-label="Status"
                    value={m.status}
                    onChange={(e) => changeStatus(m.id, e.target.value as ContactMessageStatusValue)}
                    className="rounded-lg border border-admin-border px-2 py-1 text-xs font-semibold text-admin-text"
                  >
                    {CONTACT_MESSAGE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(m.id)}
                    aria-label="Delete message"
                    className="flex size-8 items-center justify-center rounded-lg text-admin-text-muted hover:bg-red-50 hover:text-admin-error"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this message?"
        description="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
