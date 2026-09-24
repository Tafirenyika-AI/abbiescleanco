import { getIntegrationValue } from "../integrationSettings";
import { getSiteUrl } from "../siteUrl";

/**
 * TikTok OAuth connect (Login Kit + Content Posting API). Like Google Ads, this lays down a
 * real, working connection (access/refresh token for the real TikTok account); actual video
 * publishing via the Content Posting API is a separate next step once TikTok has approved the
 * `video.publish` scope for the developer app (an audited scope -- approval isn't instant, and
 * until it's granted only `video.upload` to the user's own inbox for manual publish works).
 */

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";

export async function getTikTokCredentials(): Promise<{ clientKey?: string; clientSecret?: string }> {
  const clientKey = await getIntegrationValue("tiktokClientKey", "TIKTOK_CLIENT_KEY");
  const clientSecret = await getIntegrationValue("tiktokClientSecret", "TIKTOK_CLIENT_SECRET");
  return { clientKey, clientSecret };
}

export function tiktokRedirectUri(): string {
  return `${getSiteUrl()}/api/admin/marketing/connections/tiktok/callback`;
}

export async function buildTikTokAuthUrl(state: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { clientKey } = await getTikTokCredentials();
  if (!clientKey) return { ok: false, error: "TikTok Client Key isn't configured yet. Save it under Settings → Integrations first." };

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("redirect_uri", tiktokRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  url.searchParams.set("state", state);
  return { ok: true, url: url.toString() };
}

interface TikTokTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
}

export interface TikTokConnectedAccount {
  accountId: string; // open_id
  accountName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function exchangeTikTokCode(code: string): Promise<{ ok: true; account: TikTokConnectedAccount } | { ok: false; error: string }> {
  const { clientKey, clientSecret } = await getTikTokCredentials();
  if (!clientKey || !clientSecret) return { ok: false, error: "TikTok app credentials aren't configured." };

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: tiktokRedirectUri() }),
  });
  const tokenData = (await tokenRes.json().catch(() => null)) as TikTokTokenResponse | null;
  if (!tokenRes.ok || !tokenData?.access_token || !tokenData?.open_id) {
    return { ok: false, error: tokenData?.error_description || tokenData?.error || "TikTok rejected the authorization code." };
  }

  const infoRes = await fetch(`${USER_INFO_URL}?fields=display_name`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const infoData = (await infoRes.json().catch(() => null)) as { data?: { user?: { display_name?: string } }; error?: { message?: string } } | null;
  const accountName = infoData?.data?.user?.display_name || tokenData.open_id;

  return {
    ok: true,
    account: {
      accountId: tokenData.open_id,
      accountName,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
      expiresAt: new Date(Date.now() + (tokenData.expires_in ?? 86400) * 1000),
    },
  };
}
