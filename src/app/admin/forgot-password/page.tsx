"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "sent">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    await fetch("/api/admin/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Always show the same success state — never reveal whether an account exists.
    setState("sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <ShieldCheck className="size-6 text-admin-aqua" aria-hidden />
          <span className="font-display text-lg font-semibold">Abbie&apos;s Admin</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-400">We&apos;ll email you a link to choose a new one.</p>

          {state === "sent" ? (
            <p className="mt-6 rounded-lg bg-admin-teal/10 p-4 text-sm text-admin-aqua">
              If an admin account exists for that email, we&apos;ve sent a link to reset your password.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-admin-teal focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={state === "submitting"}
                className="ios-press flex w-full items-center justify-center gap-2 rounded-lg bg-admin-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-admin-teal-hover disabled:opacity-60"
              >
                {state === "submitting" ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        <Link href="/admin/login" className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-300">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
