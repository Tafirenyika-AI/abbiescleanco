"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ProfileForm({ name, email, isDemo }: { name: string; email: string; isDemo: boolean }) {
  const [nameValue, setNameValue] = useState(name);
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [nameError, setNameError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameState("saving");
    const res = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameValue }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setNameState("error");
      setNameError(json.error || "Save failed");
      return;
    }
    setNameState("saved");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordState("saving");
    const res = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setPasswordState("error");
      setPasswordError(json.error || "Save failed");
      return;
    }
    setPasswordState("saved");
    setCurrentPassword("");
    setNewPassword("");
  }

  if (isDemo) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-slate-900">
        You&apos;re signed in as the demo admin (env-based login, no DATABASE_URL configured).
        Profile changes require a real database — see README.md.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveName} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Your details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Name</span>
            <input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Email</span>
            <input value={email} disabled className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-500" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={nameState === "saving"} className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60">
            {nameState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
          </button>
          {nameState === "saved" && <span className="flex items-center gap-1 text-sm text-teal-700"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
          {nameState === "error" && <span className="text-sm text-red-600">{nameError}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Change password</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">New password</span>
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={passwordState === "saving"} className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60">
            {passwordState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Update password"}
          </button>
          {passwordState === "saved" && <span className="flex items-center gap-1 text-sm text-teal-700"><CheckCircle2 className="size-4" aria-hidden /> Updated</span>}
          {passwordState === "error" && <span className="text-sm text-red-600">{passwordError}</span>}
        </div>
      </form>
    </div>
  );
}
