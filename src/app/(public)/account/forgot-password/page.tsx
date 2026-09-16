"use client";

import { useState } from "react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "sent">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    await fetch("/api/account/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Always show the same success state — never reveal whether an account exists.
    setState("sent");
  }

  return (
    <Section>
      <div className="mx-auto max-w-sm rounded-3xl border border-surface-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-navy-950">Reset your password</h1>

        {state === "sent" ? (
          <p className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-navy-900">
            If an account exists for that email, we&apos;ve sent a link to reset your password.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-navy-900">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" />
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={state === "submitting"}>
              {state === "submitting" ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
    </Section>
  );
}
