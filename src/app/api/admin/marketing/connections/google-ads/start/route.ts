import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createOAuthState } from "@/lib/server/oauthState";
import { buildGoogleAdsAuthUrl } from "@/lib/server/social/googleAds";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const state = createOAuthState(admin.id);
  const result = await buildGoogleAdsAuthUrl(state);
  if (!result.ok) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(result.error)}`, req.url));
  return NextResponse.redirect(result.url);
}
