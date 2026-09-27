import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { saveAvatarImage, MediaError } from "@/lib/server/mediaUpload";
import { prisma, isDatabaseConfigured } from "@/lib/db";

// No permission required beyond being a valid logged-in admin -- everyone manages their own
// profile picture regardless of what else they're allowed to do, same as /api/admin/profile.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (admin.id === "demo-admin" || !isDatabaseConfigured || !prisma) {
    return NextResponse.json({ ok: false, error: "Profile changes require DATABASE_URL to be configured." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  try {
    const { url } = await saveAvatarImage(file);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { avatarUrl: url } });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    console.error("saveAvatarImage failed:", err);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (admin.id === "demo-admin" || !isDatabaseConfigured || !prisma) {
    return NextResponse.json({ ok: false, error: "Profile changes require DATABASE_URL to be configured." }, { status: 503 });
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { avatarUrl: null } });
  return NextResponse.json({ ok: true });
}
