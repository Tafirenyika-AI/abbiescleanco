import { FileStack } from "lucide-react";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default function AdminInvoicesPage() {
  return (
    <ComingSoonModule
      icon={FileStack}
      title="Invoices"
      tagline="A formal, printable invoice per job — beyond what Quotes + Payments show today."
      blocked={{
        reason: "Needs your call on how formal this should be.",
        detail: "Quote + Payment already function as an informal invoice today (see any booking's Payment section). A real Invoice entity with numbering, PDF export, and receivables aging is genuinely buildable next without any new credential — just needs prioritizing against everything else on the list.",
      }}
      capabilities={[
        "A numbered invoice generated from an accepted quote, with line items and payment history",
        "Downloadable/printable PDF you can send to a customer",
        "Receivables aging — who owes what, and for how long",
        "A clear distinction between billed revenue, collected cash, and accounting profit",
      ]}
    />
  );
}
