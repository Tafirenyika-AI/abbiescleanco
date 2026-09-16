import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, listAdminUsers, hasPermission } from "@/lib/server/adminUsers";
import { isDatabaseConfigured } from "@/lib/db";
import AdminUsersManager from "@/components/admin/AdminUsersManager";

export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_USERS")) {
    redirect("/admin");
  }

  const users = await listAdminUsers();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Admin users</h1>
      <p className="mt-1 text-sm text-slate-600">
        Create staff accounts and control exactly which admin sections each person can access.
      </p>
      <div className="mt-6">
        <AdminUsersManager initialUsers={users} currentAdminId={admin.id} databaseConfigured={isDatabaseConfigured} />
      </div>
    </div>
  );
}
