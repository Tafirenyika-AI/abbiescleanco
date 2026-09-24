import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/server/oauthState";
import { exchangeMetaCodeForAccounts } from "@/lib/server/social/meta";
import { upsertConnection } from "@/lib/server/marketingConnections";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = verifyOAuthState(searchParams.get("state"));
  const oauthError = searchParams.get("error_description") || searchParams.get("error");

  if (oauthError) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(oauthError)}`, req.url));
  if (!code || !state) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent("Invalid or expired connection attempt -- try again.")}`, req.url));

  const result = await exchangeMetaCodeForAccounts(code);
  if (!result.ok) return NextResponse.redirect(new URL(`/admin/marketing?connectError=${encodeURIComponent(result.error)}`, req.url));

  for (const account of result.accounts) {
    await upsertConnection({
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName,
      accessToken: account.accessToken,
      metadata: account.metadata,
      connectedById: state.adminUserId,
    });
  }

  return NextResponse.redirect(new URL(`/admin/marketing?connected=meta&count=${result.accounts.length}`, req.url));
}
