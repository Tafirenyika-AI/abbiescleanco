import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listEmailTemplates } from "@/lib/server/emailTemplates";
import EmailTemplateEditor from "@/components/admin/settings/EmailTemplateEditor";

export default async function EmailTemplateEditPage({ params }: { params: Promise<{ key: string }> }) {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "MANAGE_USERS")) redirect("/admin");

  const { key } = await params;
  const templates = await listEmailTemplates();
  const template = templates.find((t) => t.key === key);
  if (!template) notFound();

  return (
    <div>
      <EmailTemplateEditor template={template} />
    </div>
  );
}
