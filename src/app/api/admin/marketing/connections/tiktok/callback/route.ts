import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/server/oauthState";
import { exchangeTikTokCode } from "@/lib/server/social/tiktok";
import { upsertConnection } from "@/lib/server/marketingConnections";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = verifyOAuthState(searchParams.get("state"));
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(oauthError)}`, req.url));
  if (!code || !state) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent("Invalid or expired connection attempt -- try again.")}`, req.url));

  const result = await exchangeTikTokCode(code);
  if (!result.ok) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(result.error)}`, req.url));

  await upsertConnection({
    platform: "TIKTOK",
    accountId: result.account.accountId,
    accountName: result.account.accountName,
    accessToken: result.account.accessToken,
    refreshToken: result.account.refreshToken || null,
    tokenExpiresAt: result.account.expiresAt,
    connectedById: state.adminUserId,
  });

  return NextResponse.redirect(new URL(`/admin/marketing?connected=tiktok`, req.url));
}
