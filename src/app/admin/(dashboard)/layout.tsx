import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile } from "@/lib/server/adminUsers";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <AdminShell adminName={admin.name} adminRole={admin.role} permissions={admin.permissions}>
      {children}
    </AdminShell>
  );
}
