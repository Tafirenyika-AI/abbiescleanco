"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload, X, MessageSquare } from "lucide-react";
import Button from "@/components/ui/Button";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  customer: { firstName: string; lastName: string; phone: string; avatarUrl: string | null; smsConsent: boolean } | null;
}

export default function AccountProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(profile.customer?.avatarUrl ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setAvatarError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/account/profile/avatar", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAvatarError(json.error || "Upload failed");
        return;
      }
      setAvatar(json.url);
      router.refresh();
    } catch {
      setAvatarError("Upload failed, check your connection and try again.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarError("");
    await fetch("/api/account/profile/avatar", { method: "DELETE" }).catch(() => {});
    setAvatar(null);
    setAvatarBusy(false);
    router.refresh();
  }

  const [firstName, setFirstName] = useState(profile.customer?.firstName || "");
  const [lastName, setLastName] = useState(profile.customer?.lastName || "");
  const [phone, setPhone] = useState(profile.customer?.phone || "");
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");

  const [smsConsent, setSmsConsent] = useState(profile.customer?.smsConsent ?? false);
  const [smsState, setSmsState] = useState<"idle" | "saving" | "error">("idle");

  async function toggleSmsConsent(next: boolean) {
    setSmsConsent(next); // optimistic -- this is a simple on/off toggle, not a form with its own submit
    setSmsState("saving");
    const res = await fetch("/api/account/sms-preference", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smsConsent: next }),
    });
    if (!res.ok) {
      setSmsConsent(!next); // revert
      setSmsState("error");
      return;
    }
    setSmsState("idle");
  }

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
      <div className="rounded-2xl border border-surface-200 bg-white p-6">
        <h2 className="font-semibold text-navy-950">Profile picture</h2>
        <div className="mt-4 flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-16 shrink-0 rounded-full border border-surface-200 object-cover" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xl font-semibold text-teal-700">
              {(profile.customer?.firstName || profile.name || profile.email).charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 px-3.5 py-1.5 text-xs font-semibold text-navy-900 hover:bg-surface-50 disabled:opacity-60"
              >
                {avatarBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Upload className="size-3.5" aria-hidden />}
                {avatar ? "Change photo" : "Upload photo"}
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={avatarBusy}
                  className="inline-flex items-center gap-1 rounded-full border border-surface-200 px-3 py-1.5 text-xs font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-60"
                >
                  <X className="size-3.5" aria-hidden /> Remove
                </button>
              )}
            </div>
            {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

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

      <div className="rounded-2xl border border-surface-200 bg-white p-6">
        <h2 className="flex items-center gap-2 font-semibold text-navy-950">
          <MessageSquare className="size-4" aria-hidden /> SMS service notifications
        </h2>
        <p className="mt-1.5 text-sm text-surface-700">
          Appointment reminders, scheduling updates, and other service-related texts. Message frequency may vary, message and data rates may apply, and this is never a condition of using our service.
        </p>
        <label className="mt-4 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={smsConsent}
            onClick={() => toggleSmsConsent(!smsConsent)}
            disabled={smsState === "saving"}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${smsConsent ? "bg-teal-600" : "bg-surface-300"}`}
          >
            <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${smsConsent ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm font-medium text-navy-950">{smsConsent ? "On" : "Off"}</span>
        </label>
        {smsState === "error" && <p className="mt-2 text-sm text-red-600">Couldn&apos;t save, please try again.</p>}
        <p className="mt-3 text-xs text-surface-600">
          Reply STOP to any text to opt out at any time. Your mobile information is never sold or shared with third parties for promotional or marketing purposes. See our{" "}
          <a href="/policies/privacy" className="underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
      </div>

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
