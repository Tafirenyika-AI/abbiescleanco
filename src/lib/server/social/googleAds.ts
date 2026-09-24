import { getIntegrationValue } from "../integrationSettings";
import { getSiteUrl } from "../siteUrl";

/**
 * Google Ads OAuth connect. This lays down a real, working connection (refresh token +
 * accessible customer ids) using Google's standard OAuth2 + the Ads API's own
 * `listAccessibleCustomers` endpoint. Creating/running actual ad campaigns (budgets, ad
 * groups, ads, targeting) is a separate, larger slice of the Google Ads API's mutate surface
 * -- not built yet. Connecting the account first is the real, honest, independently-useful
 * step: it proves the OAuth app + developer token work before any code tries to spend money.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADS_API_VERSION = "v19";

export async function getGoogleAdsCredentials(): Promise<{ clientId?: string; clientSecret?: string; developerToken?: string; loginCustomerId?: string }> {
  const clientId = await getIntegrationValue("googleAdsClientId", "GOOGLE_ADS_CLIENT_ID");
  const clientSecret = await getIntegrationValue("googleAdsClientSecret", "GOOGLE_ADS_CLIENT_SECRET");
  const developerToken = await getIntegrationValue("googleAdsDeveloperToken", "GOOGLE_ADS_DEVELOPER_TOKEN");
  const loginCustomerId = await getIntegrationValue("googleAdsLoginCustomerId", "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  return { clientId, clientSecret, developerToken, loginCustomerId };
}

export function googleAdsRedirectUri(): string {
  return `${getSiteUrl()}/api/admin/marketing/connections/google-ads/callback`;
}

export async function buildGoogleAdsAuthUrl(state: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { clientId } = await getGoogleAdsCredentials();
  if (!clientId) return { ok: false, error: "Google Ads OAuth Client ID isn't configured yet. Save it under Settings → Integrations first." };

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleAdsRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { ok: true, url: url.toString() };
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface GoogleAdsConnectedAccount {
  accountId: string; // customer id, digits only
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function exchangeGoogleAdsCode(code: string): Promise<{ ok: true; accounts: GoogleAdsConnectedAccount[] } | { ok: false; error: string }> {
  const { clientId, clientSecret, developerToken } = await getGoogleAdsCredentials();
  if (!clientId || !clientSecret) return { ok: false, error: "Google Ads OAuth credentials aren't configured." };
  if (!developerToken) return { ok: false, error: "Google Ads Developer Token isn't configured yet -- get one from the Google Ads API Center before connecting." };

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleAdsRedirectUri(), grant_type: "authorization_code" }),
  });
  const tokenData = (await tokenRes.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!tokenRes.ok || !tokenData?.access_token || !tokenData?.refresh_token) {
    return { ok: false, error: tokenData?.error_description || tokenData?.error || "Google rejected the authorization code (no refresh token returned -- make sure you approved offline access)." };
  }

  const listRes = await fetch(`https://googleads.googleapis.com/${ADS_API_VERSION}/customers:listAccessibleCustomers`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "developer-token": developerToken },
  });
  const listData = (await listRes.json().catch(() => null)) as { resourceNames?: string[]; error?: { message?: string } } | null;
  if (!listRes.ok || !Array.isArray(listData?.resourceNames)) {
    return { ok: false, error: listData?.error?.message || "Couldn't list accessible Google Ads accounts -- check the developer token is approved for this account." };
  }
  if (listData.resourceNames.length === 0) {
    return { ok: false, error: "No accessible Google Ads accounts found for this login." };
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);
  const accounts = listData.resourceNames.map((resourceName) => ({
    accountId: resourceName.replace("customers/", ""),
    accessToken: tokenData.access_token!,
    refreshToken: tokenData.refresh_token!,
    expiresAt,
  }));
  return { ok: true, accounts };
}
