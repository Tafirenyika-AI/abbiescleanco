"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Loader2, UsersRound, Banknote, ChevronDown, ChevronUp } from "lucide-react";
import type { TeamMemberItem } from "@/lib/server/teamStore";
import type { WorkerJobSummary } from "@/lib/server/bookingStore";
import {
  SUBCONTRACTOR_PAY_TYPES,
  subcontractorPayTypeLabels,
  type WorkforceSubcontractorRow,
  type SubcontractorPayType,
} from "@/lib/subcontractors";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import BulkDeleteBar from "@/components/admin/ui/BulkDeleteBar";
import { useToast } from "@/components/admin/ui/Toast";
import { useBulkSelect } from "@/lib/admin/useBulkSelect";
import { formatDateTime } from "@/lib/adminDate";

type TeamRow = TeamMemberItem & { upcomingJobs: WorkerJobSummary[] };
type SubRow = WorkforceSubcontractorRow & { upcomingJobs: WorkerJobSummary[] };

function UpcomingJobsList({ jobs }: { jobs: WorkerJobSummary[] }) {
  if (jobs.length === 0) return <p className="mt-2 text-xs text-admin-text-muted">No upcoming jobs assigned right now.</p>;
  return (
    <ul className="mt-2 space-y-1.5">
      {jobs.map((j) => (
        <li key={j.id} className="flex items-center justify-between gap-2 text-xs">
          <Link href={`/admin/bookings/${j.id}`} className="text-admin-teal-hover hover:underline">
            {j.reference} · {j.customerName}
          </Link>
          <span className="text-admin-text-muted">{j.scheduledStart ? formatDateTime(j.scheduledStart) : "Unscheduled"}</span>
        </li>
      ))}
    </ul>
  );
}

function TeamRowCard({ member, onDeleted, checked, onToggle }: { member: TeamRow; onDeleted: (id: string) => void; checked: boolean; onToggle: () => void }) {
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
  const [expanded, setExpanded] = useState(false);

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
      <div className="flex items-start gap-2.5">
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${member.name}`} className="mt-2" />
        <div className="flex-1">
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
              <button type="button" onClick={() => setExpanded((e) => !e)} className="inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
                Upcoming jobs {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="size-3.5 animate-spin text-admin-text-muted" aria-hidden />}
              <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Remove team member" className="flex size-8 items-center justify-center rounded-lg text-admin-error hover:bg-red-50">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          {expanded && <UpcomingJobsList jobs={member.upcomingJobs} />}
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

function SubcontractorRowCard({ sub }: { sub: SubRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/admin/finance/subcontractors/${sub.id}`} className="font-medium text-admin-text hover:underline">{sub.name}</Link>
          <p className="mt-0.5 text-xs text-admin-text-muted">{subcontractorPayTypeLabels[sub.payType]} · {sub.phone || sub.email || "No contact on file"}</p>
        </div>
        <Badge tone={sub.status === "ACTIVE" ? "success" : "neutral"}>{sub.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Badge tone="neutral">{sub.assignedJobs} assigned</Badge>
        <Badge tone="success">{sub.completedJobs} completed</Badge>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="inline-flex items-center gap-1 text-xs font-semibold text-admin-teal-hover hover:underline">
          Upcoming jobs {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
        </button>
        <Link href={`/admin/finance/subcontractors/${sub.id}`} className="text-xs font-semibold text-admin-teal-hover hover:underline">View payables</Link>
      </div>
      {expanded && <UpcomingJobsList jobs={sub.upcomingJobs} />}
    </Card>
  );
}

function NewSubcontractorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: WorkforceSubcontractorRow) => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [payType, setPayType] = useState<SubcontractorPayType>("PER_JOB");
  const [payRate, setPayRate] = useState("");
  const [payRatePercent, setPayRatePercent] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/finance/subcontractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email: email.trim() || undefined, phone: phone.trim() || undefined, payType,
        payRateCents: payType !== "PERCENTAGE" ? Math.round(Number(payRate || 0) * 100) : undefined,
        payRatePercent: payType === "PERCENTAGE" ? Number(payRatePercent || 0) : undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!data?.ok) return showToast(data?.error || "Couldn't create subcontractor", "error");
    showToast("Subcontractor added.", "success");
    onCreated({ ...data.subcontractor, assignedJobs: 0, completedJobs: 0 });
  }

  return (
    <div className="ios-backdrop-in fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-modal-in w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.1),0_24px_64px_rgba(15,23,42,0.16)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-admin-text">New subcontractor</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-admin-text-muted">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-admin-text-muted">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
            </div>
            <div>
              <label className="text-xs font-semibold text-admin-text-muted">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-admin-text-muted">Pay type</label>
            <select value={payType} onChange={(e) => setPayType(e.target.value as SubcontractorPayType)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text">
              {SUBCONTRACTOR_PAY_TYPES.map((p) => <option key={p} value={p}>{subcontractorPayTypeLabels[p]}</option>)}
            </select>
          </div>
          {payType === "PERCENTAGE" ? (
            <div>
              <label className="text-xs font-semibold text-admin-text-muted">Percent of job total</label>
              <input type="number" min="1" max="100" value={payRatePercent} onChange={(e) => setPayRatePercent(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-admin-text-muted">{payType === "HOURLY" ? "Rate per hour ($)" : payType === "FLAT_MONTHLY" ? "Flat monthly amount ($)" : "Rate per job ($)"}</label>
              <input type="number" min="0" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-2 text-sm text-admin-text" />
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="ios-press rounded-lg border border-admin-border px-3.5 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">Cancel</button>
          <button type="button" disabled={saving || !name.trim()} onClick={create} className="ios-press rounded-lg bg-admin-teal px-3.5 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkforceManager({
  initialTeam,
  initialSubcontractors,
  canManageSubcontractorPay,
}: {
  initialTeam: TeamRow[];
  initialSubcontractors: SubRow[];
  canManageSubcontractorPay: boolean;
}) {
  const { showToast } = useToast();
  const [team, setTeam] = useState(initialTeam);
  const [subcontractors, setSubcontractors] = useState(initialSubcontractors);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Cleaner");
  const [creating, setCreating] = useState(false);
  const [showNewSubForm, setShowNewSubForm] = useState(false);

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
    setTeam((prev) => [
      ...prev,
      { id: json.id, name, email: null, phone: null, role, qualifications: [], workingHours: null, isActive: true, notes: null, assignedJobs: 0, completedJobs: 0, upcomingJobs: [] },
    ]);
    setName("");
    showToast("Team member added", "success");
  }

  const activeTeamCount = team.filter((m) => m.isActive).length;
  const activeSubCount = subcontractors.filter((s) => s.status === "ACTIVE").length;
  const bulk = useBulkSelect(team.map((m) => m.id));
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  async function deleteSelected() {
    setBulkDeleting(true);
    const res = await fetch("/api/admin/team/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...bulk.selected] }),
    });
    const data = await res.json().catch(() => null);
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
    if (!data?.ok) return showToast("Couldn't remove the selected team members", "error");
    setTeam((prev) => prev.filter((m) => !bulk.selected.has(m.id)));
    showToast(`Removed ${data.deleted} team member${data.deleted === 1 ? "" : "s"}.`, "success");
    bulk.clear();
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">Workforce</h1>
        <p className="mt-1 text-sm text-admin-text-muted">
          {team.length} team member{team.length === 1 ? "" : "s"} ({activeTeamCount} active) · {subcontractors.length} subcontractor{subcontractors.length === 1 ? "" : "s"} ({activeSubCount} active).
          Assign either to a job from that job&apos;s own page.
        </p>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-admin-text">Team</h2>
        <Card className="mt-3">
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

        <div className="mt-4">
          <BulkDeleteBar count={bulk.selected.size} itemLabel="team member" onDelete={() => setConfirmBulkDelete(true)} onClear={bulk.clear} busy={bulkDeleting} />
        </div>

        <div className="mt-2 space-y-3">
          {team.length === 0 ? (
            <EmptyState icon={UsersRound} title="No team members yet" description="Add your cleaners above to start assigning them to bookings." />
          ) : (
            team.map((m) => (
              <TeamRowCard
                key={m.id}
                member={m}
                onDeleted={(id) => setTeam((prev) => prev.filter((x) => x.id !== id))}
                checked={bulk.selected.has(m.id)}
                onToggle={() => bulk.toggle(m.id)}
              />
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-admin-text">Subcontractors</h2>
          {canManageSubcontractorPay && (
            <button type="button" onClick={() => setShowNewSubForm(true)} className="ios-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover">
              <Plus className="size-4" aria-hidden /> New subcontractor
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-admin-text-muted">
          {canManageSubcontractorPay ? (
            <>Pay rates, tax info, and payouts are managed in <Link href="/admin/finance/subcontractors" className="text-admin-teal-hover hover:underline">Finance → Subcontractors</Link>; this is their roster and job assignments.</>
          ) : (
            "Pay rates, tax info, and adding a new subcontractor need Finance access."
          )}
        </p>

        <div className="mt-3 space-y-3">
          {subcontractors.length === 0 ? (
            <EmptyState icon={Banknote} title="No subcontractors yet" description="Add one to start assigning jobs to them." />
          ) : (
            subcontractors.map((s) => <SubcontractorRowCard key={s.id} sub={s} />)
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Remove ${bulk.selected.size} team member${bulk.selected.size === 1 ? "" : "s"}?`}
        description="This can't be undone."
        confirmLabel={bulkDeleting ? "Removing…" : "Remove"}
        tone="danger"
        onConfirm={deleteSelected}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      {showNewSubForm && (
        <NewSubcontractorModal
          onClose={() => setShowNewSubForm(false)}
          onCreated={(s) => {
            setSubcontractors((prev) => [...prev, { ...s, upcomingJobs: [] }].sort((a, b) => a.name.localeCompare(b.name)));
            setShowNewSubForm(false);
          }}
        />
      )}
    </div>
  );
}
