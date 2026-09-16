"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, ShieldOff, Copy } from "lucide-react";

type TwoFactorStep = "idle" | "setup" | "confirm" | "backup-codes";

export default function ProfileForm({
  name,
  email,
  isDemo,
  twoFactorEnabled,
}: {
  name: string;
  email: string;
  isDemo: boolean;
  twoFactorEnabled: boolean;
}) {
  const [nameValue, setNameValue] = useState(name);
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [nameError, setNameError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [passwordError, setPasswordError] = useState("");

  const [enabled, setEnabled] = useState(twoFactorEnabled);
  const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStep>("idle");
  const [secretFormatted, setSecretFormatted] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);

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

  async function startSetup() {
    setTwoFactorBusy(true);
    setTwoFactorError("");
    const res = await fetch("/api/admin/profile/2fa/setup", { method: "POST" });
    const json = await res.json();
    setTwoFactorBusy(false);
    if (!res.ok || !json.ok) {
      setTwoFactorError(json.error || "Couldn't start setup");
      return;
    }
    setSecretFormatted(json.secretFormatted);
    setTwoFactorStep("setup");
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorBusy(true);
    setTwoFactorError("");
    const res = await fetch("/api/admin/profile/2fa/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: confirmCode }),
    });
    const json = await res.json();
    setTwoFactorBusy(false);
    if (!res.ok || !json.ok) {
      setTwoFactorError(json.error || "Couldn't verify code");
      return;
    }
    setBackupCodes(json.backupCodes);
    setEnabled(true);
    setConfirmCode("");
    setTwoFactorStep("backup-codes");
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorBusy(true);
    setTwoFactorError("");
    const res = await fetch("/api/admin/profile/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: disablePassword }),
    });
    const json = await res.json();
    setTwoFactorBusy(false);
    if (!res.ok || !json.ok) {
      setTwoFactorError(json.error || "Couldn't disable");
      return;
    }
    setEnabled(false);
    setShowDisableForm(false);
    setDisablePassword("");
    setTwoFactorStep("idle");
  }

  if (isDemo) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-admin-text">
        You&apos;re signed in as the demo admin (env-based login, no DATABASE_URL configured).
        Profile changes require a real database — see README.md.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveName} className="rounded-2xl border border-admin-border bg-admin-card p-5">
        <h2 className="font-semibold text-admin-text">Your details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-admin-text-muted">Name</span>
            <input value={nameValue} onChange={(e) => setNameValue(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-admin-text-muted">Email</span>
            <input value={email} disabled className="mt-1 w-full rounded-lg border border-admin-border bg-admin-bg px-2.5 py-1.5 text-sm text-admin-text-muted" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={nameState === "saving"} className="inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {nameState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
          </button>
          {nameState === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Saved</span>}
          {nameState === "error" && <span className="text-sm text-red-600">{nameError}</span>}
        </div>
      </form>

      <form onSubmit={savePassword} className="rounded-2xl border border-admin-border bg-admin-card p-5">
        <h2 className="font-semibold text-admin-text">Change password</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-admin-text-muted">Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-admin-text-muted">New password</span>
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={passwordState === "saving"} className="inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {passwordState === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Update password"}
          </button>
          {passwordState === "saved" && <span className="flex items-center gap-1 text-sm text-admin-teal-hover"><CheckCircle2 className="size-4" aria-hidden /> Updated</span>}
          {passwordState === "error" && <span className="text-sm text-red-600">{passwordError}</span>}
        </div>
      </form>

      <div className="rounded-2xl border border-admin-border bg-admin-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-admin-text">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-admin-text-muted">Require a code from an authenticator app when signing in.</p>
          </div>
          {enabled && twoFactorStep !== "backup-codes" && (
            <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              <ShieldCheck className="size-3.5" aria-hidden /> Enabled
            </span>
          )}
        </div>

        {twoFactorStep === "idle" && !enabled && (
          <button type="button" onClick={startSetup} disabled={twoFactorBusy} className="mt-4 inline-flex items-center gap-2 rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
            {twoFactorBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            Enable two-factor authentication
          </button>
        )}

        {twoFactorStep === "setup" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-admin-text">
              Add this account to your authenticator app (Google Authenticator, Authy, 1Password, etc.) using manual entry:
            </p>
            <div className="rounded-lg bg-admin-bg p-3">
              <p className="text-xs font-medium text-admin-text-muted">Account</p>
              <p className="text-sm text-admin-text">{email}</p>
              <p className="mt-2 text-xs font-medium text-admin-text-muted">Setup key</p>
              <p className="break-all font-mono text-sm text-admin-text">{secretFormatted}</p>
            </div>
            <form onSubmit={confirmSetup} className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="text-xs font-medium text-admin-text-muted">Enter the 6-digit code it shows</span>
                <input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  inputMode="numeric"
                  placeholder="123456"
                  className="mt-1 w-40 rounded-lg border border-admin-border px-2.5 py-1.5 text-center text-sm tracking-widest"
                />
              </label>
              <button type="submit" disabled={twoFactorBusy || confirmCode.length !== 6} className="rounded-full bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {twoFactorBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Confirm & enable"}
              </button>
              <button type="button" onClick={() => setTwoFactorStep("idle")} className="rounded-full border border-admin-border px-4 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                Cancel
              </button>
            </form>
            {twoFactorError && <p className="text-sm text-red-600">{twoFactorError}</p>}
          </div>
        )}

        {twoFactorStep === "backup-codes" && (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">Two-factor authentication is now enabled.</p>
            <p className="text-sm text-admin-text">
              Save these one-time backup codes somewhere safe — each works once if you lose access to your authenticator app. They won&apos;t be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-admin-bg p-3 font-mono text-sm text-admin-text sm:grid-cols-4">
              {backupCodes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(backupCodes.join("\n")).catch(() => {});
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-admin-border px-3.5 py-1.5 text-xs font-semibold text-admin-text hover:bg-admin-bg"
            >
              <Copy className="size-3.5" aria-hidden /> Copy codes
            </button>
            <div>
              <button type="button" onClick={() => setTwoFactorStep("idle")} className="text-sm font-semibold text-admin-teal-hover hover:underline">
                Done
              </button>
            </div>
          </div>
        )}

        {enabled && twoFactorStep === "idle" && (
          <div className="mt-4">
            {!showDisableForm ? (
              <button type="button" onClick={() => setShowDisableForm(true)} className="inline-flex items-center gap-2 rounded-full border border-admin-error/30 px-4 py-2 text-sm font-semibold text-admin-error hover:bg-red-50">
                <ShieldOff className="size-4" aria-hidden /> Disable two-factor authentication
              </button>
            ) : (
              <form onSubmit={disable} className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-admin-text-muted">Confirm your password</span>
                  <input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className="mt-1 w-56 rounded-lg border border-admin-border px-2.5 py-1.5 text-sm" />
                </label>
                <button type="submit" disabled={twoFactorBusy} className="rounded-full bg-admin-error px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {twoFactorBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Disable"}
                </button>
                <button type="button" onClick={() => setShowDisableForm(false)} className="rounded-full border border-admin-border px-4 py-2 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                  Cancel
                </button>
              </form>
            )}
            {twoFactorError && <p className="mt-2 text-sm text-red-600">{twoFactorError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
