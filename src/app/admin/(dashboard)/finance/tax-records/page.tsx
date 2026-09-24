import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FileCheck2 } from "lucide-react";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default async function AdminFinanceTaxRecordsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_TAX_RECORDS")) redirect("/admin");

  return (
    <ComingSoonModule
      icon={FileCheck2}
      title="Tax records"
      tagline="Recordkeeping, not tax preparation -- organizes real revenue, expenses, and receipts for you or your accountant, and reminds you about filing deadlines you configure."
      blocked={{
        reason: "Needs your real filing obligations to be configured -- never assumed.",
        detail: "This app won't guess which taxes/filings apply to this business, and won't file or pay anything automatically. Once the expense/invoice foundation (this session's work) is live, this becomes a real recordkeeping layer over it plus a reminders list you set up yourself.",
      }}
      capabilities={[
        "Monthly/quarterly/annual financial packages, ready to hand to an accountant",
        "Real revenue, expenses, subcontractor payments, and receipts organized by period",
        "Reminders for filing deadlines you configure (name, agency, frequency, due date) -- never auto-assumed",
        "Never automatically files or pays a tax on your behalf",
      ]}
    />
  );
}
