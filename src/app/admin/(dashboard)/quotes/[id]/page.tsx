import { notFound } from "next/navigation";
import { getQuoteById } from "@/lib/server/quoteStore";
import QuoteDetailView from "@/components/admin/quotes/QuoteDetailView";

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  return (
    <QuoteDetailView
      mode="edit"
      leadId={quote.leadId}
      leadReference={quote.leadReference}
      customerName={quote.customerName}
      customerEmail={quote.customerEmail}
      customerPhone={quote.customerPhone}
      companyName={quote.companyName}
      serviceAddress={quote.serviceAddress}
      serviceName={quote.serviceName}
      approxSquareFeet={quote.approxSquareFeet}
      quote={quote}
    />
  );
}
