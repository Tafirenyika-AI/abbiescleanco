import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createAdminUserSchema } from "@/lib/validation/adminUser";
import { listAdminUsers, createAdminUser } from "@/lib/server/adminUsers";
import { isDatabaseConfigured } from "@/lib/db";
import { sendEmail, adminInviteEmail } from "@/lib/server/email";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const users = await listAdminUsers();
  return NextResponse.json({ ok: true, users, databaseConfigured: isDatabaseConfigured });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      { ok: false, error: "Creating additional admin users requires DATABASE_URL to be configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createAdminUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const created = await createAdminUser(parsed.data);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { subject, html } = adminInviteEmail({ name: parsed.data.name, loginUrl: `${siteUrl}/admin/login` });
    await sendEmail({ to: parsed.data.email, subject, html });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    const message = err instanceof Error && err.message.includes("Unique constraint")
      ? "An admin user with that email already exists."
      : "Could not create admin user.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
