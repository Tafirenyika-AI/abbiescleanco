import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createPaymentLinkForInvoices } from "@/lib/server/invoicePaymentLinkStore";
import { sendEmail, paymentLinkEmail } from "@/lib/server/email";
import { getContactInfo } from "@/lib/server/siteSettings";

const schema = z.object({
  invoiceIds: z.array(z.string().trim().min(1)).min(1).max(50),
  emailToCustomer: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await createPaymentLinkForInvoices(parsed.data.invoiceIds);
  if (!result.ok || !result.url) return NextResponse.json({ ok: false, error: result.error || "Couldn't create payment link" }, { status: 400 });

  if (parsed.data.emailToCustomer && result.customerEmail) {
    const { subject, html } = await paymentLinkEmail({
      firstName: (result.customerName || "there").split(" ")[0] || "there",
      amountLabel: `$${(result.amount! / 100).toFixed(2)}`,
      description:
        parsed.data.invoiceIds.length === 1 ? "You have an invoice ready for payment." : `You have ${parsed.data.invoiceIds.length} invoices ready for payment, combined into one charge below.`,
      url: result.url,
    });
    const contact = await getContactInfo();
    await sendEmail({ to: result.customerEmail, subject, html, bcc: contact.email || undefined });
  }

  return NextResponse.json({ ok: true, url: result.url, amount: result.amount, emailed: !!(parsed.data.emailToCustomer && result.customerEmail) });
}
