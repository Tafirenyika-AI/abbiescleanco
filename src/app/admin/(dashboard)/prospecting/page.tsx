import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listProspects, isPlacesSearchConfigured, isWebLeadSearchConfigured } from "@/lib/server/prospectStore";
import ProspectingManager from "@/components/admin/prospecting/ProspectingManager";

export default async function AdminProspectingPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_LEADS")) {
    redirect("/admin");
  }

  const [prospects, placesConfigured, webSearchConfigured] = await Promise.all([listProspects(), isPlacesSearchConfigured(), isWebLeadSearchConfigured()]);

  return <ProspectingManager initialProspects={prospects} placesConfigured={placesConfigured} webSearchConfigured={webSearchConfigured} />;
}
