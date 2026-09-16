"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  customer: { firstName: string; lastName: string; phone: string } | null;
}

export default function AccountProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.customer?.firstName || "");
  const [lastName, setLastName] = useState(profile.customer?.lastName || "");
  const [phone, setPhone] = useState(profile.customer?.phone || "");
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileState("saving");
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setProfileState("error");
      setProfileError(json.error || "Save failed");
      return;
    }
    setProfileState("saved");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordState("saving");
    const res = await fetch("/api/account/change-password", {
      method: "POST",
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

  async function signOut() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveProfile} className="rounded-2xl border border-surface-200 bg-white p-6">
        <h2 className="font-semibold text-navy-950">Contact details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-navy-900">Email</span>
            <input value={profile.email} disabled className="mt-1.5 w-full rounded-xl border border-surface-200 bg-surface-50 px-3.5 py-2.5 text-sm text-surface-700" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-navy-900">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" size="md" disabled={profileState === "saving"}>
            {profileState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save changes"}
          </Button>
          {profileState === "saved" && (
            <span className="flex items-center gap-1 text-sm text-teal-700"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>
          )}
          {profileState === "error" && <span className="text-sm text-red-600">{profileError}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className="rounded-2xl border border-surface-200 bg-white p-6">
        <h2 className="font-semibold text-navy-950">Change password</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">New password</span>
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" size="md" disabled={passwordState === "saving"}>
            {passwordState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Update password"}
          </Button>
          {passwordState === "saved" && (
            <span className="flex items-center gap-1 text-sm text-teal-700"><CheckCircle2 className="size-4" aria-hidden /> Updated</span>
          )}
          {passwordState === "error" && <span className="text-sm text-red-600">{passwordError}</span>}
        </div>
      </form>

      <button type="button" onClick={signOut} className="text-sm font-semibold text-surface-700 hover:text-navy-950">
        Sign out
      </button>
    </div>
  );
}
