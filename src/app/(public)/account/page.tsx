import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { getProfile } from "@/lib/server/accounts";
import { getMyRequests, getMyQuotes, getMyBookings, getMyPayments } from "@/lib/server/customerHistory";
import Section from "@/components/ui/Section";
import AccountDashboard from "@/components/account/AccountDashboard";

// Real account history (requests/quotes/bookings/payments) -- never cache this per-customer page.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const session = verifyCustomerSessionToken(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) redirect("/account/login?next=/account");

  const profile = await getProfile(session.userId);
  if (!profile) redirect("/account/login?next=/account");

  const customerId = profile.customer?.id;
  const [requests, quotes, bookings, payments] = customerId
    ? await Promise.all([getMyRequests(customerId), getMyQuotes(customerId), getMyBookings(customerId), getMyPayments(customerId)])
    : [[], [], [], []];

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold text-navy-950">My account</h1>
        <p className="mt-1 text-sm text-surface-700">Every request, quote, booking, and payment tied to your account, in one place.</p>
        <div className="mt-8">
          <AccountDashboard profile={profile} requests={requests} quotes={quotes} bookings={bookings} payments={payments} />
        </div>
      </div>
    </Section>
  );
}
