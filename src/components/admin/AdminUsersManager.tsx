"use client";

import { useState } from "react";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { ALL_ADMIN_PERMISSIONS, permissionLabels, type AdminPermission, type AdminProfile } from "@/lib/permissions";

function PermissionCheckboxes({
  selected,
  onChange,
  disabled,
}: {
  selected: AdminPermission[];
  onChange: (next: AdminPermission[]) => void;
  disabled?: boolean;
}) {
  function toggle(permission: AdminPermission) {
    onChange(selected.includes(permission) ? selected.filter((p) => p !== permission) : [...selected, permission]);
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ALL_ADMIN_PERMISSIONS.map((permission) => (
        <label key={permission} className="flex items-start gap-2 text-sm text-admin-text">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={selected.includes(permission)}
            disabled={disabled}
            onChange={() => toggle(permission)}
          />
          {permissionLabels[permission]}
        </label>
      ))}
    </div>
  );
}

function EditableUserRow({ user, isSelf, onSaved }: { user: AdminProfile; isSelf: boolean; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [permissions, setPermissions] = useState<AdminPermission[]>(user.permissions);
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setState("saving");
    setError("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, permissions, isActive, password: password || undefined }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setState("error");
      setError(json.error || "Save failed");
      return;
    }
    setPassword("");
    setState("saved");
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-admin-border bg-admin-card p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Email</span>
          <input value={user.email} disabled className="mt-1 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text-muted" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Role label</span>
          <input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
        </label>
      </div>

      <div className="mt-4">
        <span className="text-xs font-medium text-admin-text-muted">Permissions</span>
        <div className="mt-1.5">
          <PermissionCheckboxes selected={permissions} onChange={setPermissions} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} disabled={isSelf} onChange={(e) => setIsActive(e.target.checked)} />
          Active {isSelf && <span className="text-xs text-admin-text-muted">(can&apos;t deactivate yourself)</span>}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">Reset password (optional)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" size="md" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
        </Button>
        {state === "saved" && (
          <span className="flex items-center gap-1 text-sm text-admin-teal-hover">
            <CheckCircle2 className="size-4" aria-hidden /> Saved
          </span>
        )}
        {state === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export default function AdminUsersManager({
  initialUsers,
  currentAdminId,
  databaseConfigured,
}: {
  initialUsers: AdminProfile[];
  currentAdminId: string;
  databaseConfigured: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Staff" });
  const [newPermissions, setNewPermissions] = useState<AdminPermission[]>([]);
  const [createState, setCreateState] = useState<"idle" | "saving" | "error">("idle");
  const [createError, setCreateError] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    if (json.ok) setUsers(json.users);
  }

  async function createUser() {
    setCreateState("saving");
    setCreateError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newUser, permissions: newPermissions }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setCreateState("error");
      setCreateError(json.error || "Could not create user");
      return;
    }
    setCreateState("idle");
    setShowCreate(false);
    setNewUser({ name: "", email: "", password: "", role: "Staff" });
    setNewPermissions([]);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {!databaseConfigured && (
        <p className="rounded-xl bg-warm-100 p-3 text-sm text-admin-text">
          No DATABASE_URL is configured — only the single demo admin account exists. Connect a database to create
          and manage additional admin users with individual permissions.
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-admin-text-muted">{users.length} admin {users.length === 1 ? "account" : "accounts"}</p>
        {databaseConfigured && (
          <Button type="button" variant="outline" size="md" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" aria-hidden /> New admin user
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-admin-border bg-admin-card p-5">
          <h3 className="font-semibold text-admin-text">New admin user</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Name</span>
              <input value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Email</span>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Temporary password</span>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Role label</span>
              <input value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
            </label>
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium text-admin-text-muted">Permissions</span>
            <div className="mt-1.5">
              <PermissionCheckboxes selected={newPermissions} onChange={setNewPermissions} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" size="md" onClick={createUser} disabled={createState === "saving"}>
              {createState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Create user"}
            </Button>
            {createState === "error" && <span className="text-sm text-red-600">{createError}</span>}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {users.map((user) => (
          <EditableUserRow key={user.id} user={user} isSelf={user.id === currentAdminId} onSaved={refresh} />
        ))}
      </div>
    </div>
  );
}
