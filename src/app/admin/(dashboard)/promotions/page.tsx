import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listPromoCodes } from "@/lib/server/promoCodeStore";
import PromotionsManager from "@/components/admin/promotions/PromotionsManager";

export default async function AdminPromotionsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_PRICING")) {
    redirect("/admin");
  }

  const promoCodes = await listPromoCodes();

  return <PromotionsManager promoCodes={promoCodes} />;
}
