import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FolderOpen } from "lucide-react";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default async function AdminFinanceDocumentsPage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;
  if (!admin || !hasPermission(admin, "FINANCE_DOCUMENTS")) redirect("/admin");

  return (
    <ComingSoonModule
      icon={FolderOpen}
      title="Financial document vault"
      tagline="Receipts, bank statements, tax documents, and insurance/contractor paperwork, searchable by type, year, vendor, or amount."
      blocked={{
        reason: "Not built yet -- comes with the receipt scanner (next Finance phase).",
        detail: "Files are stored in private object storage (the same Vercel Blob setup already used for photos/videos), never inside the database. Real search by type/year/vendor/customer/amount/date once there are real documents to search.",
      }}
      capabilities={[
        "Every receipt, invoice, bank statement, and tax document in one searchable place",
        "Search by type, year, vendor, customer, amount, or date",
        "Private object storage -- never stored as a database blob",
      ]}
    />
  );
}
