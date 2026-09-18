import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewLeadForm from "@/components/admin/leads/NewLeadForm";

export default function NewLeadPage() {
  return (
    <div>
      <Link href="/admin/leads" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to leads
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-admin-text sm:text-[28px]">New lead</h1>
      <p className="mt-1 text-sm text-admin-text-muted">Log a phone-in or walk-in request — this calculates the same preliminary estimate the website would.</p>
      <div className="mt-6">
        <NewLeadForm />
      </div>
    </div>
  );
}
