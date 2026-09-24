"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Login failed");
        setLoading(false);
        return;
      }
      if (json.requires2FA) {
        setStep("2fa");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Verification failed");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-admin-text">
          <ShieldCheck className="size-6 text-admin-teal-hover" aria-hidden />
          <span className="font-display text-lg font-semibold">Abbie&apos;s Admin</span>
        </div>

        <div className="glass-card rounded-2xl border border-admin-border bg-admin-card p-8 shadow-xl">
          {step === "credentials" ? (
            <>
              <h1 className="text-xl font-semibold text-admin-text">Sign in</h1>
              <p className="mt-1 text-sm text-admin-text-muted">Internal access only.</p>

              <form onSubmit={onSubmitCredentials} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-admin-text">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-admin-border bg-white px-3.5 py-2.5 text-sm text-admin-text placeholder:text-slate-500 focus:border-admin-teal focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-admin-text">Password</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-admin-border bg-white px-3.5 py-2.5 text-sm text-admin-text focus:border-admin-teal focus:outline-none"
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="admin-button admin-button-primary ios-press flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-admin-teal-hover disabled:opacity-60"
                >
                  {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <Link href="/admin/forgot-password" className="mt-4 block text-center text-sm text-slate-500 hover:text-admin-text">
                Forgot password?
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-admin-text">Two-factor code</h1>
              <p className="mt-1 text-sm text-admin-text-muted">Enter the 6-digit code from your authenticator app, or a backup code.</p>

              <form onSubmit={onSubmitCode} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-admin-text">Code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="mt-1.5 w-full rounded-lg border border-admin-border bg-white px-3.5 py-2.5 text-center text-lg tracking-[0.3em] text-admin-text placeholder:tracking-normal placeholder:text-slate-500 focus:border-admin-teal focus:outline-none"
                  />
                </label>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="admin-button admin-button-primary ios-press flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-admin-teal-hover disabled:opacity-60"
                >
                  {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {loading ? "Verifying…" : "Verify"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setCode("");
                  setError(null);
                }}
                className="mt-4 block w-full text-center text-sm text-slate-500 hover:text-admin-text"
              >
                ← Back
              </button>
            </>
          )}
        </div>

        <Link href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-admin-text">
          ← Back to public site
        </Link>
      </div>
    </div>
  );
}
