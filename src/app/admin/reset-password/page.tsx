"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setError(null);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error || "This reset link is invalid or has expired.");
      setState("idle");
      return;
    }
    setState("done");
    setTimeout(() => router.push("/admin/login"), 2000);
  }

  if (!token) {
    return (
      <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-700">
        This reset link is missing its token. Request a new one from the{" "}
        <a href="/admin/forgot-password" className="underline">forgot password</a> page.
      </p>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-admin-border bg-admin-card p-8 shadow-xl">
      <h1 className="text-xl font-semibold text-admin-text">Choose a new password</h1>

      {state === "done" ? (
        <p className="mt-6 rounded-lg bg-admin-teal/10 p-4 text-sm text-admin-teal-hover">
          Password updated — redirecting you to sign in…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-admin-text">New password</span>
            <input
              type="password"
              required
              minLength={8}
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
            disabled={state === "submitting"}
            className="admin-button admin-button-primary ios-press flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-admin-teal-hover disabled:opacity-60"
          >
            {state === "submitting" ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-admin-text">
          <ShieldCheck className="size-6 text-admin-teal-hover" aria-hidden />
          <span className="font-display text-lg font-semibold">Abbie&apos;s Admin</span>
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
