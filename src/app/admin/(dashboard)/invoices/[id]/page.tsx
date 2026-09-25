import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { getInvoiceById } from "@/lib/server/invoiceStore";
import { getContactInfo, getBranding } from "@/lib/server/siteSettings";
import { business } from "@/lib/data/business";
import InvoiceDetailView from "@/components/admin/invoices/InvoiceDetailView";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "FINANCE_VIEW")) {
    redirect("/admin");
  }

  const { id } = await params;
  const [invoice, contact, branding] = await Promise.all([getInvoiceById(id), getContactInfo(), getBranding()]);
  if (!invoice) notFound();

  return (
    <InvoiceDetailView
      invoice={invoice}
      business={{ name: business.name, legalName: business.legalName, city: business.city, region: business.region }}
      contact={contact}
      logoUrl={branding.logoUrl ?? "/images/logo.png"}
    />
  );
}
