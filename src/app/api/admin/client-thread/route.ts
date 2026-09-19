import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { sendEmail } from "@/lib/server/email";
import { business } from "@/lib/data/business";

function whereFor(sp: { leadId?: string | null; bookingId?: string | null }) {
  if (sp.bookingId) return { bookingId: sp.bookingId };
  if (sp.leadId) return { leadId: sp.leadId };
  return null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ ok: true, notes: [], attachments: [], photoEstimates: [] });

  const where = whereFor({ leadId: req.nextUrl.searchParams.get("leadId"), bookingId: req.nextUrl.searchParams.get("bookingId") });
  if (!where) return NextResponse.json({ ok: false, error: "Missing target" }, { status: 400 });

  // A booking's thread also includes what the customer attached to the originating request.
  let originLeadId: string | undefined = "leadId" in where ? where.leadId : undefined;
  if ("bookingId" in where) {
    const b = await prisma.booking.findUnique({ where: { id: where.bookingId }, select: { leadId: true } });
    originLeadId = b?.leadId ?? undefined;
  }
  const orWhere = "bookingId" in where ? [where, ...(originLeadId ? [{ leadId: originLeadId }] : [])] : [where];
  const [notes, attachments, photoEstimates] = await Promise.all([
    prisma.clientNote.findMany({ where: { OR: orWhere }, orderBy: { createdAt: "asc" } }),
    prisma.attachment.findMany({ where: { OR: orWhere, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.photoEstimate.findMany({ where: originLeadId ? { leadId: originLeadId } : { id: "none" }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    ok: true,
    notes: notes.map((n) => ({ id: n.id, body: n.body, author: n.author, authorName: n.authorName, kind: n.kind, createdAt: n.createdAt.toISOString() })),
    attachments: attachments.map((a) => ({ id: a.id, kind: a.kind, url: a.url, caption: a.caption, uploadedBy: a.uploadedBy, createdAt: a.createdAt.toISOString() })),
    photoEstimates: photoEstimates.map((p) => ({ id: p.id, mode: p.mode, low: p.estimateLow, high: p.estimateHigh, hoursLow: p.hoursLow, hoursHigh: p.hoursHigh, serviceId: p.serviceId, createdAt: p.createdAt.toISOString() })),
  });
}

const schema = z.object({ leadId: z.string().optional(), bookingId: z.string().optional(), body: z.string().trim().min(1).max(4000), emailCustomer: z.boolean().optional() });

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!prisma) return NextResponse.json({ ok: false, error: "Database required" }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Write a message first" }, { status: 400 });
  const { leadId, bookingId, body, emailCustomer } = parsed.data;

  let customerId: string | null = null;
  let resolvedLeadId = leadId ?? null;
  if (bookingId) {
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    customerId = b?.customerId ?? null;
    resolvedLeadId = b?.leadId ?? null;
  } else if (leadId) {
    customerId = (await prisma.lead.findUnique({ where: { id: leadId } }))?.customerId ?? null;
  }
  if (!customerId) return NextResponse.json({ ok: false, error: "This record has no customer to message" }, { status: 400 });

  await prisma.clientNote.create({ data: { customerId, leadId: resolvedLeadId, bookingId: bookingId ?? null, body, author: "STAFF", authorName: admin.name || "Abbie's Clean Method", kind: "NOTE" } });

  if (emailCustomer) {
    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    if (c?.email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
      await sendEmail({
        to: c.email,
        subject: `A message from ${business.name}`,
        html: `<div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto"><h2 style="color:#0b1f33">Hi ${c.firstName.replace(/[<>&"']/g, "")},</h2><p>We've added a message to your request. Sign in to read it and reply:</p><p><a href="${siteUrl}/account" style="color:#0d8f83">${siteUrl}/account</a></p><p style="color:#4a5a6a;font-size:14px">${business.name}</p></div>`,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
