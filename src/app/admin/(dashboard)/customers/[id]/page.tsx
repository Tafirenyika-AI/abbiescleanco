import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/server/customerStore";
import CustomerDetailView from "@/components/admin/customers/CustomerDetailView";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();
  return <CustomerDetailView customer={customer} />;
}
