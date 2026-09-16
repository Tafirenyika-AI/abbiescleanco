import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile } from "@/lib/server/adminUsers";
import ProfileForm from "@/components/admin/ProfileForm";

export default async function AdminProfilePage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">My profile</h1>
      <p className="mt-1 text-sm text-slate-600">Manage your own name and password.</p>
      <div className="mt-6">
        <ProfileForm name={admin.name} email={admin.email} isDemo={admin.id === "demo-admin"} />
      </div>
    </div>
  );
}
