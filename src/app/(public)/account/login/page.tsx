"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/login", {
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
      router.push(searchParams.get("next") || "/account");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm glass-card rounded-3xl border border-surface-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-navy-950">Sign in</h1>
      <p className="mt-1 text-sm text-surface-700">Track your requests and manage your details.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-navy-900">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-navy-900">Password</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/account/forgot-password" className="text-teal-600 hover:underline">Forgot password?</Link>
        <Link href="/account/signup" className="text-teal-600 hover:underline">Create an account</Link>
      </div>
    </div>
  );
}

export default function AccountLoginPage() {
  return (
    <Section>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </Section>
  );
}
