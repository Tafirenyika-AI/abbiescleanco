import { notFound } from "next/navigation";
import { getQuoteById } from "@/lib/server/quoteStore";
import { getContactInfo, getBranding } from "@/lib/server/siteSettings";
import { business } from "@/lib/data/business";
import QuoteDetailView from "@/components/admin/quotes/QuoteDetailView";

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, contact, branding] = await Promise.all([getQuoteById(id), getContactInfo(), getBranding()]);
  if (!quote) notFound();

  return (
    <QuoteDetailView
      mode="edit"
      business={{ name: business.name, legalName: business.legalName, city: business.city, region: business.region }}
      contact={contact}
      logoUrl={branding.logoUrl ?? "/images/logo.png"}
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
