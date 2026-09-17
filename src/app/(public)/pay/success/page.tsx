import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Payment received",
  robots: { index: false, follow: false },
};

export default function PaymentSuccessPage() {
  return (
    <Section className="py-20 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-teal-100 text-teal-600">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-3xl font-semibold text-navy-950">Payment received</h1>
        <p className="mt-3 text-surface-700">
          Thank you! Your payment to {business.name} has gone through. You&apos;ll get an email receipt shortly,
          and we&apos;ll be in touch about your cleaning.
        </p>
        <div className="mt-6">
          <Button href="/">Back to homepage</Button>
        </div>
      </div>
    </Section>
  );
}
