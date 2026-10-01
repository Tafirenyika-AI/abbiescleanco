import Link from "next/link";
import { getLeadQuoteContext } from "@/lib/server/quoteStore";
import { getLeadById } from "@/lib/server/leadStore";
import QuoteDetailView from "@/components/admin/quotes/QuoteDetailView";
import EmptyState from "@/components/admin/ui/EmptyState";
import { FileSignature } from "lucide-react";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  const [context, lead] = leadId ? await Promise.all([getLeadQuoteContext(leadId), getLeadById(leadId)]) : [null, null];

  if (!context || !lead) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Choose a lead first"
        description="Quotes are created from a lead's detail panel so customer and service info carries over automatically."
        action={<Link href="/admin/leads" className="text-sm font-semibold text-admin-teal-hover hover:underline">Go to leads →</Link>}
      />
    );
  }

  const suggestedUnitPrice = !lead.estimate.requiresManualQuote
    ? Math.round(((lead.estimate.totalLow + lead.estimate.totalHigh) / 2) * 100)
    : undefined;

  return (
    <QuoteDetailView
      mode="create"
      leadId={context.leadId}
      leadReference={context.leadReference}
      customerName={context.customerName}
      customerEmail={context.customerEmail}
      customerPhone={context.customerPhone}
      companyName={context.companyName}
      serviceAddress={context.serviceAddress}
      serviceName={context.serviceName}
      approxSquareFeet={context.approxSquareFeet}
      quote={null}
      suggestedUnitPrice={suggestedUnitPrice}
      leadPromoCode={lead.input.promoCode ?? null}
    />
  );
}
