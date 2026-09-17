import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getAutomationRules, listRecentAutomationEvents } from "@/lib/server/automationStore";
import AutomationsManager from "@/components/admin/automations/AutomationsManager";

export default async function AdminAutomationsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_CONTENT")) {
    redirect("/admin");
  }

  const [rules, events] = await Promise.all([getAutomationRules(), listRecentAutomationEvents(100)]);

  return <AutomationsManager rules={rules} events={events} />;
}
