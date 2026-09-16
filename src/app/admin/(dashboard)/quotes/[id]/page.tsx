import { notFound } from "next/navigation";
import { getQuoteById } from "@/lib/server/quoteStore";
import { getLeadById } from "@/lib/server/leadStore";
import QuoteDetailView from "@/components/admin/quotes/QuoteDetailView";

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();
  const lead = await getLeadById(quote.leadId);

  return (
    <QuoteDetailView
      mode="edit"
      leadId={quote.leadId}
      leadReference={lead?.reference ?? "—"}
      customerName={quote.customerName}
      customerPhone={quote.customerPhone}
      serviceName={quote.serviceName}
      quote={quote}
    />
  );
}
