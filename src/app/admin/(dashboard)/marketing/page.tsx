import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listCampaigns, listPosts } from "@/lib/server/marketingStore";
import MarketingManager from "@/components/admin/marketing/MarketingManager";

export default async function AdminMarketingPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "MANAGE_CONTENT")) redirect("/admin");

  const [campaigns, posts] = await Promise.all([listCampaigns(), listPosts()]);

  return <MarketingManager initialCampaigns={campaigns} initialPosts={posts} />;
}
