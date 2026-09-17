import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listContactMessages } from "@/lib/server/contactMessageStore";
import MessagesManager from "@/components/admin/messages/MessagesManager";

export default async function AdminMessagesPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_LEADS")) {
    redirect("/admin");
  }

  const messages = await listContactMessages();

  return <MessagesManager messages={messages} />;
}
