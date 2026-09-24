import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { setQuoteStatus, getQuoteById, QUOTE_STATUSES } from "@/lib/server/quoteStore";
import { notifyAdmins } from "@/lib/server/notificationStore";

const schema = z.object({ status: z.enum(QUOTE_STATUSES) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const result = await setQuoteStatus(id, parsed.data.status, admin.id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  if (parsed.data.status === "ACCEPTED" || parsed.data.status === "DECLINED") {
    const quote = await getQuoteById(id);
    if (quote) {
      await notifyAdmins(
        parsed.data.status === "ACCEPTED" ? "QUOTE_ACCEPTED" : "QUOTE_DECLINED",
        `Quote ${parsed.data.status === "ACCEPTED" ? "accepted" : "declined"}: ${quote.quoteNumber}`,
        `${quote.customerName}, $${(quote.total / 100).toFixed(2)}`,
        `/admin/quotes/${id}`
      );
    }
  }

  return NextResponse.json({ ok: true });
}
