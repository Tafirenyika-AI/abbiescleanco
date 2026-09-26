import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listEmailTemplates } from "@/lib/server/emailTemplates";
import EmailTemplatesList from "@/components/admin/settings/EmailTemplatesList";

export default async function EmailTemplatesPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "MANAGE_USERS")) redirect("/admin");

  const templates = await listEmailTemplates();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Email templates</h1>
      <p className="mt-1 text-sm text-admin-text-muted">
        The real wording for every email this app sends. Edit one directly, or ask AI to draft a rewrite -- nothing sends differently until you save.
      </p>
      <EmailTemplatesList templates={templates} />
    </div>
  );
}
