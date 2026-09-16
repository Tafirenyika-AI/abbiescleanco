import { listPayments, listBookingsAwaitingPayment } from "@/lib/server/paymentStore";
import PaymentsView from "@/components/admin/payments/PaymentsView";

export default async function AdminPaymentsPage() {
  const [payments, bookingsAwaitingPayment] = await Promise.all([listPayments(), listBookingsAwaitingPayment()]);
  return <PaymentsView payments={payments} bookingsAwaitingPayment={bookingsAwaitingPayment} />;
}
