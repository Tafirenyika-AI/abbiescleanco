import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listSubcontractors } from "@/lib/server/subcontractorStore";
import SubcontractorsManager from "@/components/admin/finance/SubcontractorsManager";

export default async function AdminFinanceSubcontractorsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_SUBCONTRACTORS")) redirect("/admin");

  const subcontractors = await listSubcontractors();
  return <SubcontractorsManager initialSubcontractors={subcontractors} />;
}
