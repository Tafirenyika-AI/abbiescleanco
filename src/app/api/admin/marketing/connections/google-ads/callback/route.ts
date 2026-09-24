import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/server/oauthState";
import { exchangeGoogleAdsCode } from "@/lib/server/social/googleAds";
import { upsertConnection } from "@/lib/server/marketingConnections";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = verifyOAuthState(searchParams.get("state"));
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(oauthError)}`, req.url));
  if (!code || !state) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent("Invalid or expired connection attempt -- try again.")}`, req.url));

  const result = await exchangeGoogleAdsCode(code);
  if (!result.ok) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(result.error)}`, req.url));

  for (const account of result.accounts) {
    await upsertConnection({
      platform: "GOOGLE_ADS",
      accountId: account.accountId,
      accountName: `Google Ads ${account.accountId}`,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      tokenExpiresAt: account.expiresAt,
      connectedById: state.adminUserId,
    });
  }

  return NextResponse.redirect(new URL(`/admin/marketing?connected=google-ads&count=${result.accounts.length}`, req.url));
}
