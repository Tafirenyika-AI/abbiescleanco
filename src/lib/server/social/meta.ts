import { getIntegrationValue } from "../integrationSettings";
import { getSiteUrl } from "../siteUrl";

/**
 * Meta (Facebook Page + Instagram Business account) OAuth connect + real Graph API publish.
 * Uses the "self-use" Meta app pattern: since the business connects its OWN Page/IG account
 * (not a third party's), no public App Review is required for `pages_manage_posts` /
 * `instagram_content_publish` as long as the connecting admin is an admin of that real Page --
 * Meta's own documented exemption for apps only used by their own business assets.
 */

const GRAPH_VERSION = "v21.0";

interface MetaErrorBody {
  error?: { message?: string };
}

export async function getMetaAppCredentials(): Promise<{ appId?: string; appSecret?: string }> {
  const appId = await getIntegrationValue("metaAppId", "META_APP_ID");
  const appSecret = await getIntegrationValue("metaAppSecret", "META_APP_SECRET");
  return { appId, appSecret };
}

export function metaRedirectUri(): string {
  return `${getSiteUrl()}/api/admin/marketing/connections/meta/callback`;
}

export async function buildMetaAuthUrl(state: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { appId } = await getMetaAppCredentials();
  if (!appId) return { ok: false, error: "Meta App ID isn't configured yet. Save it under Settings → Integrations first." };

  const scopes = ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management", "instagram_basic", "instagram_content_publish"].join(",");
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");
  return { ok: true, url: url.toString() };
}

export interface MetaConnectedAccount {
  platform: "META_FACEBOOK" | "META_INSTAGRAM";
  accountId: string;
  accountName: string;
  accessToken: string;
  metadata?: Record<string, unknown>;
}

interface MetaPageRow {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

export async function exchangeMetaCodeForAccounts(code: string): Promise<{ ok: true; accounts: MetaConnectedAccount[] } | { ok: false; error: string }> {
  const { appId, appSecret } = await getMetaAppCredentials();
  if (!appId || !appSecret) return { ok: false, error: "Meta app credentials aren't configured." };

  const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", metaRedirectUri());
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = (await tokenRes.json().catch(() => null)) as (MetaErrorBody & { access_token?: string }) | null;
  if (!tokenRes.ok || !tokenData?.access_token) {
    return { ok: false, error: tokenData?.error?.message || "Meta rejected the authorization code." };
  }

  // Exchange the short-lived user token for a long-lived one (~60 days). Page tokens derived
  // from a long-lived user token don't expire on their own as long as the Page stays connected.
  const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);
  const longRes = await fetch(longUrl.toString());
  const longData = (await longRes.json().catch(() => null)) as { access_token?: string } | null;
  const longLivedToken = longData?.access_token || tokenData.access_token;

  const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  pagesUrl.searchParams.set("access_token", longLivedToken);
  const pagesRes = await fetch(pagesUrl.toString());
  const pagesData = (await pagesRes.json().catch(() => null)) as (MetaErrorBody & { data?: MetaPageRow[] }) | null;
  if (!pagesRes.ok || !Array.isArray(pagesData?.data)) {
    return { ok: false, error: pagesData?.error?.message || "Couldn't list your Facebook Pages." };
  }
  if (pagesData.data.length === 0) {
    return { ok: false, error: "No Facebook Pages found for this account. You need to be a real admin of at least one Page to connect it." };
  }

  const accounts: MetaConnectedAccount[] = [];
  for (const page of pagesData.data) {
    accounts.push({ platform: "META_FACEBOOK", accountId: page.id, accountName: page.name, accessToken: page.access_token });
    if (page.instagram_business_account?.id) {
      accounts.push({
        platform: "META_INSTAGRAM",
        accountId: page.instagram_business_account.id,
        accountName: page.instagram_business_account.username || page.name,
        accessToken: page.access_token,
        metadata: { pageId: page.id },
      });
    }
  }
  return { ok: true, accounts };
}

export async function publishToFacebookPage(pageId: string, accessToken: string, caption: string, mediaUrl?: string | null): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const endpoint = mediaUrl ? `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos` : `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
  const params = new URLSearchParams({ access_token: accessToken });
  if (mediaUrl) { params.set("url", mediaUrl); params.set("caption", caption); } else { params.set("message", caption); }
  const res = await fetch(endpoint, { method: "POST", body: params });
  const data = (await res.json().catch(() => null)) as (MetaErrorBody & { id?: string; post_id?: string }) | null;
  const postId = data?.post_id || data?.id;
  if (!res.ok || !postId) return { ok: false, error: data?.error?.message || "Facebook rejected the post." };
  return { ok: true, postId };
}

export async function publishToInstagram(igUserId: string, accessToken: string, caption: string, mediaUrl: string): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const createRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    body: new URLSearchParams({ access_token: accessToken, image_url: mediaUrl, caption }),
  });
  const createData = (await createRes.json().catch(() => null)) as (MetaErrorBody & { id?: string }) | null;
  if (!createRes.ok || !createData?.id) return { ok: false, error: createData?.error?.message || "Instagram rejected the media." };

  const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ access_token: accessToken, creation_id: createData.id }),
  });
  const publishData = (await publishRes.json().catch(() => null)) as (MetaErrorBody & { id?: string }) | null;
  if (!publishRes.ok || !publishData?.id) return { ok: false, error: publishData?.error?.message || "Instagram rejected publishing." };
  return { ok: true, postId: publishData.id };
}
