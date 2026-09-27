import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { saveAvatarImage, MediaError } from "@/lib/server/mediaUpload";
import { setAvatar } from "@/lib/server/accounts";

export async function POST(req: NextRequest) {
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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
    const ok = await setAvatar(session.userId, url);
    if (!ok) return NextResponse.json({ ok: false, error: "No customer profile to attach a photo to." }, { status: 400 });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    console.error("saveAvatarImage failed:", err);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  await setAvatar(session.userId, null);
  return NextResponse.json({ ok: true });
}
