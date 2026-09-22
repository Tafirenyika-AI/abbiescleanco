import { Landmark } from "lucide-react";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default function AdminAccountingPage() {
  return (
    <ComingSoonModule
      icon={Landmark}
      title="Accounting"
      tagline="Sync bookings, payments, and expenses to a real accounting platform."
      blocked={{
        reason: "Needs your decision on which accounting platform to use.",
        detail: "QuickBooks (or another established platform) is the recommended path over a hand-built ledger, per the project's own guidance — but that's your call to make, not one to assume. Tell us which one and we'll build the sync.",
      }}
      capabilities={[
        "Two-way sync of invoices, payments, and expenses with your accounting platform",
        "No duplicate revenue on retried or duplicate webhook events",
        "Real bank reconciliation once a live accounting/bank feed exists",
        "No automated bank-detail changes, payouts, or refunds without your explicit approval",
      ]}
    />
  );
}
