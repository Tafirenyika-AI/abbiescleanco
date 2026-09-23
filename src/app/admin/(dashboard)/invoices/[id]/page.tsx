import { notFound } from "next/navigation";
import { getInvoiceById } from "@/lib/server/invoiceStore";
import { getContactInfo } from "@/lib/server/siteSettings";
import { business } from "@/lib/data/business";
import InvoiceDetailView from "@/components/admin/invoices/InvoiceDetailView";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, contact] = await Promise.all([getInvoiceById(id), getContactInfo()]);
  if (!invoice) notFound();

  return (
    <InvoiceDetailView
      invoice={invoice}
      business={{ name: business.name, legalName: business.legalName, city: business.city, region: business.region }}
      contact={contact}
    />
  );
}
