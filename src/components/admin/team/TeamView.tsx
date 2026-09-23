"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, UsersRound } from "lucide-react";
import type { TeamMemberItem } from "@/lib/server/teamStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";

function Row({ member, onDeleted }: { member: TeamMemberItem; onDeleted: (id: string) => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: member.name,
    email: member.email ?? "",
    phone: member.phone ?? "",
    role: member.role,
    workingHours: member.workingHours ?? "",
    isActive: member.isActive,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(patch: Partial<typeof form>) {
    setSaving(true);
    await fetch(`/api/admin/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }

  async function confirmDeleteMember() {
    setDeleting(true);
    const res = await fetch(`/api/admin/team/${member.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (!res.ok) {
      showToast("Couldn't remove team member", "error");
      return;
    }
    onDeleted(member.id);
  }

  return (
    <Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Name</span>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} onBlur={() => save({ name: form.name })} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Role</span>
          <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} onBlur={() => save({ role: form.role })} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Phone</span>
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} onBlur={() => save({ phone: form.phone })} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Email</span>
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} onBlur={() => save({ email: form.email })} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-admin-text-muted">Working hours</span>
          <input value={form.workingHours} onChange={(e) => setForm((f) => ({ ...f, workingHours: e.target.value }))} onBlur={() => save({ workingHours: form.workingHours })} placeholder="e.g. Mon–Fri 8am–5pm" className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => {
                setForm((f) => ({ ...f, isActive: e.target.checked }));
                save({ isActive: e.target.checked });
              }}
            />
            Active
          </label>
          <Badge tone="neutral">{member.assignedJobs} assigned</Badge>
          <Badge tone="success">{member.completedJobs} completed</Badge>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="size-3.5 animate-spin text-admin-text-muted" aria-hidden />}
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Remove team member" className="flex size-8 items-center justify-center rounded-lg text-admin-error hover:bg-red-50">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove ${member.name}?`}
        description="This can't be undone."
        confirmLabel={deleting ? "Removing…" : "Remove"}
        tone="danger"
        onConfirm={confirmDeleteMember}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  );
}

export default function TeamView({ initialMembers }: { initialMembers: TeamMemberItem[] }) {
  const { showToast } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Cleaner");
  const [creating, setCreating] = useState(false);

  async function addMember() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok || !json.ok) {
      showToast("Couldn't add team member", "error");
      return;
    }
    setMembers((prev) => [
      ...prev,
      { id: json.id, name, email: null, phone: null, role, qualifications: [], workingHours: null, isActive: true, notes: null, assignedJobs: 0, completedJobs: 0 },
    ]);
    setName("");
    showToast("Team member added", "success");
  }

  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Team</h1>
        <p className="mt-1 text-sm text-admin-text-muted">{members.length} total · {activeCount} active</p>
      </div>

      <Card className="mt-6">
        <p className="text-sm font-semibold text-admin-text">Add a team member</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-w-[160px] flex-1 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text">
            <option value="Cleaner">Cleaner</option>
            <option value="Lead Cleaner">Lead Cleaner</option>
            <option value="Supervisor">Supervisor</option>
          </select>
          <button type="button" onClick={addMember} disabled={creating || !name.trim()} className="ios-press inline-flex items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {members.length === 0 ? (
          <EmptyState icon={UsersRound} title="No team members yet" description="Add your cleaners above to start assigning them to bookings." />
        ) : (
          members.map((m) => <Row key={m.id} member={m} onDeleted={(id) => setMembers((prev) => prev.filter((x) => x.id !== id))} />)
        )}
      </div>
    </div>
  );
}
