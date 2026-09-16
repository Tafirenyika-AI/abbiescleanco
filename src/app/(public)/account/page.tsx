import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { getProfile } from "@/lib/server/accounts";
import Section from "@/components/ui/Section";
import AccountProfileForm from "@/components/account/AccountProfileForm";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const session = verifyCustomerSessionToken(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) redirect("/account/login?next=/account");

  const profile = await getProfile(session.userId);
  if (!profile) redirect("/account/login?next=/account");

  return (
    <Section>
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-semibold text-navy-950">My account</h1>
        <p className="mt-1 text-sm text-surface-700">Manage your contact details and password.</p>
        <div className="mt-8">
          <AccountProfileForm profile={profile} />
        </div>
      </div>
    </Section>
  );
}
