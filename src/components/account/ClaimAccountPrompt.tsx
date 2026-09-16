"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";

export default function ClaimAccountPrompt({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError("");
    const res = await fetch("/api/account/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setState("error");
      setError(json.error || "Something went wrong");
      return;
    }
    setState("done");
    router.refresh();
  }

  if (state === "done") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white p-4 text-sm text-teal-700">
        <CheckCircle2 className="size-4" aria-hidden /> Account created — you can track this request from{" "}
        <a href="/account" className="underline">My account</a>.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl bg-white p-5 text-left">
      <p className="text-sm font-semibold text-navy-950">Want to track this request? Create an account</p>
      <p className="mt-1 text-xs text-surface-700">
        We&apos;ll use the name, email, and phone you already entered — just set a password.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          required
          minLength={8}
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm"
        />
        <Button type="submit" size="md" disabled={state === "saving"} className="shrink-0">
          {state === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Create account"}
        </Button>
      </div>
      {state === "error" && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
