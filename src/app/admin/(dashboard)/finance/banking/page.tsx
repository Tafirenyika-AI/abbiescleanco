import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Landmark } from "lucide-react";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default async function AdminFinanceBankingPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_VIEW")) redirect("/admin");

  return (
    <ComingSoonModule
      icon={Landmark}
      title="Banking"
      tagline="Upload a bank statement CSV and match it against real payments and expenses -- no paid banking API needed to start."
      blocked={{
        reason: "Not built yet -- next up after the Finance dashboard/invoices/expenses foundation.",
        detail: "CSV upload, duplicate detection, category suggestions, and matching against existing Payment/Expense records. Never lets the AI silently change a financial record -- every match is admin-confirmed.",
      }}
      capabilities={[
        "Upload a bank transaction CSV; duplicates detected automatically",
        "Suggested matches against real payments/expenses (\"this $86.42 Home Depot charge looks like receipt #R-203\")",
        "Admin confirms every match, not-match, or flags for review -- nothing auto-reconciles silently",
        "A real record of what's matched, unmatched, and possibly duplicated",
      ]}
    />
  );
}
