"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { contactSchema, type ContactInput, type ContactFormValues } from "@/lib/validation/contact";
import Button from "@/components/ui/Button";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone: "", message: "", isUrgent: false, emailConsent: true, _gotcha: "" },
  });

  async function onSubmit(data: ContactFormValues) {
    setState("submitting");
    const parsed = data as unknown as ContactInput;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setState(res.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-teal-600" aria-hidden />
        <p className="mt-2 font-semibold text-navy-950">Message sent!</p>
        <p className="mt-1 text-sm text-surface-700">We&apos;ll get back to you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <input type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" {...register("_gotcha")} />

      <label className="block">
        <span className="text-sm font-semibold text-navy-900">Name</span>
        <input className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("name")} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} />
        {errors.name && <p id="name-error" role="alert" className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-navy-900">Email</span>
        <input type="email" className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
        {errors.email && <p id="email-error" role="alert" className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-navy-900">Phone (optional)</span>
        <input type="tel" className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("phone")} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-navy-900">Message</span>
        <textarea rows={4} className="mt-1.5 w-full rounded-xl border border-surface-200 px-3.5 py-2.5 text-sm" {...register("message")} aria-invalid={!!errors.message} aria-describedby={errors.message ? "message-error" : undefined} />
        {errors.message && <p id="message-error" role="alert" className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
      </label>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" className="size-4" {...register("isUrgent")} />
        <span className="text-sm text-navy-900">This is an urgent / same-day inquiry</span>
      </label>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" className="size-4" {...register("emailConsent")} />
        <span className="text-sm text-navy-900">I consent to receive an email reply</span>
      </label>

      {state === "error" && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Something went wrong. Please try again, or call/WhatsApp us directly.
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={state === "submitting"}>
        {state === "submitting" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          "Send message"
        )}
      </Button>
    </form>
  );
}
