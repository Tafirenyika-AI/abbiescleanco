import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Banknote } from "lucide-react";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default async function AdminFinanceSubcontractorsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_SUBCONTRACTORS")) redirect("/admin");

  return (
    <ComingSoonModule
      icon={Banknote}
      title="Subcontractor payables"
      tagline="What's owed to each cleaner/subcontractor, pending approval, and paid this month."
      blocked={{
        reason: "Needs the Workforce & subcontractors module to exist first.",
        detail: "There's no real subcontractor account/job-assignment data yet to calculate payables from -- see Workforce under Operations. Building this before that would mean fabricating numbers, which this app doesn't do.",
      }}
      capabilities={[
        "Real amount owed per subcontractor, calculated from their completed jobs",
        "Admin review + approval before any payment is marked paid",
        "Each subcontractor sees only their own completed jobs, earnings, and payment history",
        "Dashboard totals: owed, paid this month, pending approval, next payments",
      ]}
    />
  );
}
