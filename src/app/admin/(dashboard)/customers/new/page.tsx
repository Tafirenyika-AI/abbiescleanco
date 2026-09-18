import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewCustomerForm from "@/components/admin/customers/NewCustomerForm";

export default function NewCustomerPage() {
  return (
    <div>
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to customers
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-admin-text sm:text-[28px]">New customer</h1>
      <p className="mt-1 text-sm text-admin-text-muted">Add someone directly — useful for a repeat customer who calls in without going through the estimate form.</p>
      <div className="mt-6">
        <NewCustomerForm />
      </div>
    </div>
  );
}
