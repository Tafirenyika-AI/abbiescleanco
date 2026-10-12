import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listDocuments } from "@/lib/server/documentStore";
import DocumentsManager from "@/components/admin/documents/DocumentsManager";

export default async function AdminFinanceDocumentsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_DOCUMENTS")) redirect("/admin");

  const documents = await listDocuments();

  return <DocumentsManager initialDocuments={documents} />;
}
