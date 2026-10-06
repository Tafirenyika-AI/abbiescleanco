import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listSmsMessages } from "@/lib/server/smsMessageStore";
import SmsLogView from "@/components/admin/sms/SmsLogView";

export default async function AdminSmsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_LEADS")) {
    redirect("/admin");
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const result = await listSmsMessages(page);

  return <SmsLogView result={result} />;
}
