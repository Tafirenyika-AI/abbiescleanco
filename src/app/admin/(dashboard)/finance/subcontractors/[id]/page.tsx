import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getSubcontractorById, getSubcontractorPayables } from "@/lib/server/subcontractorStore";
import SubcontractorDetail from "@/components/admin/finance/SubcontractorDetail";

export default async function AdminSubcontractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_SUBCONTRACTORS")) redirect("/admin");

  const { id } = await params;
  const [subcontractor, payables] = await Promise.all([getSubcontractorById(id), getSubcontractorPayables(id)]);
  if (!subcontractor || !payables) notFound();

  return <SubcontractorDetail subcontractor={subcontractor} payables={payables} canRecordPayout={hasPermission(admin, "FINANCE_EXPENSES")} />;
}
