import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listLeads } from "@/lib/server/leadStore";
import { listAllReviewsForAdmin } from "@/lib/server/reviews";

/**
 * Real, derived "what needs attention" counts — not a stored notification
 * log (that's a later module). Each item links to where it can be acted on.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const items: { id: string; label: string; count: number; href: string }[] = [];

  if (admin.permissions.includes("MANAGE_LEADS")) {
    const leads = await listLeads();
    const newLeads = leads.filter((l) => l.status === "NEW").length;
    if (newLeads > 0) items.push({ id: "new-leads", label: `${newLeads} new lead${newLeads === 1 ? "" : "s"}`, count: newLeads, href: "/admin/leads" });
  }

  if (admin.permissions.includes("MANAGE_REVIEWS")) {
    const reviews = await listAllReviewsForAdmin();
    const pending = reviews.filter((r) => !r.isPublished).length;
    if (pending > 0) items.push({ id: "pending-reviews", label: `${pending} review${pending === 1 ? "" : "s"} awaiting moderation`, count: pending, href: "/admin/reviews" });
  }

  const total = items.reduce((sum, i) => sum + i.count, 0);
  return NextResponse.json({ ok: true, total, items });
}
