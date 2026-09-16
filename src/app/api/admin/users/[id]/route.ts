import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateAdminUserSchema } from "@/lib/validation/adminUser";
import { updateAdminUser } from "@/lib/server/adminUsers";
import { isDatabaseConfigured } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (!isDatabaseConfigured) {
    return NextResponse.json({ ok: false, error: "Editing admin users requires DATABASE_URL to be configured." }, { status: 503 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateAdminUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  // A user can't be edited to remove their own MANAGE_USERS permission or
  // deactivate themselves — that would lock every admin out of user
  // management with no way back in short of direct DB access.
  if (id === admin.id) {
    if (parsed.data.isActive === false) {
      return NextResponse.json({ ok: false, error: "You can't deactivate your own account." }, { status: 400 });
    }
    if (parsed.data.permissions && !parsed.data.permissions.includes("MANAGE_USERS")) {
      return NextResponse.json({ ok: false, error: "You can't remove your own user-management access." }, { status: 400 });
    }
  }

  const { password, ...rest } = parsed.data;
  await updateAdminUser(id, { ...rest, password: password || undefined });
  return NextResponse.json({ ok: true });
}
