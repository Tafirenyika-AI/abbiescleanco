import { listInvoices } from "@/lib/server/invoiceStore";
import InvoicesView from "@/components/admin/invoices/InvoicesView";

export default async function AdminInvoicesPage() {
  const invoices = await listInvoices();
  return <InvoicesView invoices={invoices} />;
}
