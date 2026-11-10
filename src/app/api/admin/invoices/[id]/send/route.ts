import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getInvoiceById, markInvoiceEmailed } from "@/lib/server/invoiceStore";
import { sendEmail, invoiceEmail } from "@/lib/server/email";
import { getContactInfo } from "@/lib/server/siteSettings";
import { formatDate } from "@/lib/adminDate";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
  if (!invoice.customerEmail) return NextResponse.json({ ok: false, error: "This customer has no email on file" }, { status: 400 });

  const { subject, html } = await invoiceEmail({
    firstName: invoice.customerName.split(" ")[0] || "there",
    invoiceNumber: invoice.invoiceNumber,
    serviceDateLabel: invoice.serviceDate ? formatDate(invoice.serviceDate) : null,
    dueDateLabel: invoice.dueDate ? formatDate(invoice.dueDate) : null,
    items: invoice.items,
    total: invoice.total,
    balance: invoice.balance,
    bookingReference: invoice.bookingReference,
    notes: invoice.notes,
  });

  const contact = await getContactInfo();
  const result = await sendEmail({ to: invoice.customerEmail, subject, html, bcc: contact.email || undefined });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "Email failed to send" }, { status: 502 });

  await markInvoiceEmailed(id);
  return NextResponse.json({ ok: true, mode: result.mode });
}
