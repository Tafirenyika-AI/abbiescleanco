import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listPropertyManagers } from "@/lib/server/propertyManagerStore";
import PropertyManagersManager from "@/components/admin/propertyManagers/PropertyManagersManager";

export default async function AdminPropertyManagersPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "MANAGE_BOOKINGS")) redirect("/admin");

  const propertyManagers = await listPropertyManagers();
  return <PropertyManagersManager initialPropertyManagers={propertyManagers} />;
}
