import { listCustomers } from "@/lib/server/customerStore";
import CustomersView from "@/components/admin/customers/CustomersView";

export default async function AdminCustomersPage() {
  const customers = await listCustomers();
  return <CustomersView customers={customers} />;
}
