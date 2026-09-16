"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export default function AccountSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Sign up failed");
        setLoading(false);
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Section>
      <div className="mx-auto max-w-sm rounded-3xl border border-surface-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-navy-950">Create an account</h1>
        <p className="mt-1 text-sm text-surface-700">Track your requests and book faster next time.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">First name</span>
              <input required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Last name</span>
              <input required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Email</span>
            <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Phone (optional)</span>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-navy-900">Password</span>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-surface-700">
          Already have an account? <Link href="/account/login" className="text-teal-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </Section>
  );
}
