import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listPayments, listBookingsAwaitingPayment } from "@/lib/server/paymentStore";
import PaymentsView from "@/components/admin/payments/PaymentsView";

export default async function AdminPaymentsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "FINANCE_VIEW")) {
    redirect("/admin");
  }

  const [payments, bookingsAwaitingPayment] = await Promise.all([listPayments(), listBookingsAwaitingPayment()]);
  return <PaymentsView payments={payments} bookingsAwaitingPayment={bookingsAwaitingPayment} />;
}
