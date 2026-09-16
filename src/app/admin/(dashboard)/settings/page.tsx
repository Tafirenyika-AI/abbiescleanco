import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getBusinessHours, getSocialLinks } from "@/lib/server/siteSettings";
import { getIntegrationStatus } from "@/lib/server/integrationSettings";
import HoursAndSocialManager from "@/components/admin/settings/HoursAndSocialManager";
import IntegrationsManager from "@/components/admin/settings/IntegrationsManager";

export default async function AdminSettingsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  const canManageContent = admin && hasPermission(admin, "MANAGE_CONTENT");
  const canManageIntegrations = admin && hasPermission(admin, "MANAGE_USERS");

  if (!admin || (!canManageContent && !canManageIntegrations)) {
    redirect("/admin");
  }

  const [hours, social, integrationStatus] = await Promise.all([
    canManageContent ? getBusinessHours() : Promise.resolve(null),
    canManageContent ? getSocialLinks() : Promise.resolve(null),
    canManageIntegrations ? getIntegrationStatus() : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Business hours, social links, and third-party API connections.</p>

      <div className="mt-6 space-y-10">
        {canManageContent && hours && social && (
          <HoursAndSocialManager initialHours={hours} initialSocial={social} />
        )}

        {canManageIntegrations && integrationStatus && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
            <p className="mt-1 text-sm text-slate-600">Restricted to admins who can also manage other admin accounts.</p>
            <div className="mt-4">
              <IntegrationsManager initialStatus={integrationStatus} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
