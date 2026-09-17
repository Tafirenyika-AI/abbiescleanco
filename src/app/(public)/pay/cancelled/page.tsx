import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Payment cancelled",
  robots: { index: false, follow: false },
};

export default function PaymentCancelledPage() {
  return (
    <Section className="py-20 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warm-100 text-warm-600">
          <XCircle className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-3xl font-semibold text-navy-950">Payment cancelled</h1>
        <p className="mt-3 text-surface-700">
          No charge was made. If this was a mistake or you have questions, call or text us at{" "}
          {business.phoneDisplay} and we&apos;ll help you finish up.
        </p>
        <div className="mt-6">
          <Button href="/contact">Contact us</Button>
        </div>
      </div>
    </Section>
  );
}
