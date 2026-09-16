import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { prisma, isDatabaseConfigured } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest) {
  // No permission required beyond being a valid logged-in admin — everyone
  // manages their own profile regardless of what else they're allowed to do.
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (admin.id === "demo-admin" || !isDatabaseConfigured || !prisma) {
    return NextResponse.json({ ok: false, error: "Profile changes require DATABASE_URL to be configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;

  if (parsed.data.newPassword) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json({ ok: false, error: "Enter your current password to set a new one." }, { status: 400 });
    }
    const record = await prisma.adminUser.findUnique({ where: { id: admin.id } });
    const valid = record && (await bcrypt.compare(parsed.data.currentPassword, record.passwordHash));
    if (!valid) return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 400 });
    data.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data });
  return NextResponse.json({ ok: true });
}
