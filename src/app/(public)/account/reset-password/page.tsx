"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

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
    const res = await fetch("/api/account/reset-password", {
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
    setTimeout(() => router.push("/account/login"), 2000);
  }

  if (!token) {
    return (
      <p className="mx-auto max-w-sm rounded-xl bg-red-50 p-4 text-sm text-red-700">
        This reset link is missing its token. Request a new one from the{" "}
        <a href="/account/forgot-password" className="underline">forgot password</a> page.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-sm rounded-3xl border border-surface-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-navy-950">Choose a new password</h1>

      {state === "done" ? (
        <p className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-navy-900">
          Password updated — redirecting you to sign in…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">New password</span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={state === "submitting"}>
            {state === "submitting" ? "Saving…" : "Save new password"}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Section>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </Section>
  );
}
