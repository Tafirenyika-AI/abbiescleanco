import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listInvoices, listCompletedUninvoicedBookings } from "@/lib/server/invoiceStore";
import InvoicesView from "@/components/admin/invoices/InvoicesView";

export default async function AdminInvoicesPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "FINANCE_VIEW")) {
    redirect("/admin");
  }

  const [invoices, completedUninvoiced] = await Promise.all([
    listInvoices(),
    listCompletedUninvoicedBookings(),
  ]);
  return <InvoicesView invoices={invoices} completedUninvoiced={completedUninvoiced} />;
}
