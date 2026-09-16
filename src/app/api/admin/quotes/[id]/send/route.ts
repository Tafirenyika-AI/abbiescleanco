import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getQuoteById, setQuoteStatus } from "@/lib/server/quoteStore";
import { sendEmail, quoteEmail } from "@/lib/server/email";

const schema = z.object({ message: z.string().trim().max(1000).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine — message is optional
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const quote = await getQuoteById(id);
  if (!quote) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });
  if (!quote.customerEmail) return NextResponse.json({ ok: false, error: "This lead has no email on file" }, { status: 400 });

  const { subject, html } = quoteEmail({
    firstName: quote.customerName.split(" ")[0] || "there",
    quoteNumber: quote.quoteNumber,
    items: quote.items,
    discount: quote.discount,
    tax: quote.tax,
    deposit: quote.deposit,
    total: quote.total,
    expiresAt: quote.expiresAt,
    message: parsed.data.message,
  });
  const result = await sendEmail({ to: quote.customerEmail, subject, html });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "Email failed to send" }, { status: 502 });

  await setQuoteStatus(id, "SENT", admin.id);
  return NextResponse.json({ ok: true, mode: result.mode });
}
