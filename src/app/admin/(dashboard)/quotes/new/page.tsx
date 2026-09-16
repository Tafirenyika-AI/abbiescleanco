import Link from "next/link";
import { getLeadById } from "@/lib/server/leadStore";
import { services } from "@/lib/data/services";
import QuoteDetailView from "@/components/admin/quotes/QuoteDetailView";
import EmptyState from "@/components/admin/ui/EmptyState";
import { FileSignature } from "lucide-react";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  const lead = leadId ? await getLeadById(leadId) : null;

  if (!lead) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Choose a lead first"
        description="Quotes are created from a lead's detail panel so customer and service info carries over automatically."
        action={<Link href="/admin/leads" className="text-sm font-semibold text-admin-teal-hover hover:underline">Go to leads →</Link>}
      />
    );
  }

  const serviceName = services.find((s) => s.id === lead.input.service)?.name ?? lead.input.service;
  const suggestedUnitPrice = !lead.estimate.requiresManualQuote
    ? Math.round(((lead.estimate.totalLow + lead.estimate.totalHigh) / 2) * 100)
    : undefined;

  return (
    <QuoteDetailView
      mode="create"
      leadId={lead.id}
      leadReference={lead.reference}
      customerName={`${lead.input.firstName} ${lead.input.lastName}`.trim()}
      customerPhone={lead.input.phone}
      serviceName={serviceName}
      quote={null}
      suggestedUnitPrice={suggestedUnitPrice}
    />
  );
}
