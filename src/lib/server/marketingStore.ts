import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Marketing studio (real, buildable subset): campaign spend/ROI tracking using the UTM
 * attribution already captured on every Lead, and a draft/approve content planner. Publishing
 * directly to ad platforms is a genuine hard blocker (needs per-platform developer app
 * registration + connected business accounts) -- not attempted here; posting stays a manual,
 * human step, same "AI/admin prepares, human approves" pattern used elsewhere in this app.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Marketing studio requires DATABASE_URL to be configured.");
  return prisma;
}

export const MARKETING_CHANNELS = ["GOOGLE_ADS", "GOOGLE_BUSINESS_PROFILE", "META_FACEBOOK", "META_INSTAGRAM", "TIKTOK", "EMAIL", "OTHER"] as const;
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

export const marketingChannelLabels: Record<MarketingChannel, string> = {
  GOOGLE_ADS: "Google Ads",
  GOOGLE_BUSINESS_PROFILE: "Google Business Profile",
  META_FACEBOOK: "Facebook",
  META_INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  EMAIL: "Email",
  OTHER: "Other",
};

export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
export type CampaignStatusValue = (typeof CAMPAIGN_STATUSES)[number];

export const POST_STATUSES = ["DRAFT", "APPROVED", "POSTED", "CANCELLED"] as const;
export type PostStatusValue = (typeof POST_STATUSES)[number];

export interface CampaignListItem {
  id: string;
  name: string;
  channel: MarketingChannel;
  status: CampaignStatusValue;
  utmCampaign: string | null;
  spend: number;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  // Real ROI, computed live from Leads whose `campaign` field exactly matches utmCampaign --
  // never a guess, and null (not zero) when there's nothing to attribute against yet.
  leadsGenerated: number;
  customersAcquired: number;
  revenueGenerated: number; // cents, real collected payments (PAID, net of refunds) on bookings tied to this campaign's leads
  costPerLead: number | null; // cents
  costPerCustomer: number | null; // cents
  roi: number | null; // (revenueGenerated - spend) / spend, null if spend is 0
}

async function computeCampaignRoi(utmCampaign: string | null): Promise<{
  leadsGenerated: number;
  customersAcquired: number;
  revenueGenerated: number;
}> {
  if (!utmCampaign) return { leadsGenerated: 0, customersAcquired: 0, revenueGenerated: 0 };

  const leads = await db().lead.findMany({
    where: { campaign: utmCampaign, deletedAt: null },
    select: { id: true, customerId: true, quotes: { select: { id: true, status: true, bookings: { select: { id: true } } } } },
  });

  const leadsGenerated = leads.length;
  const customerIds = new Set(leads.map((l) => l.customerId).filter((id): id is string => Boolean(id)));
  const customersAcquired = customerIds.size;

  const bookingIds = leads.flatMap((l) => l.quotes.flatMap((q) => q.bookings.map((b) => b.id)));
  let revenueGenerated = 0;
  if (bookingIds.length > 0) {
    const agg = await db().payment.aggregate({
      where: { bookingId: { in: bookingIds }, status: "PAID" },
      _sum: { amount: true, refundAmount: true },
    });
    revenueGenerated = (agg._sum.amount ?? 0) - (agg._sum.refundAmount ?? 0);
  }

  return { leadsGenerated, customersAcquired, revenueGenerated };
}

export async function listCampaigns(): Promise<CampaignListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const campaigns = await db().marketingCampaign.findMany({ orderBy: { createdAt: "desc" } });

  return Promise.all(
    campaigns.map(async (c) => {
      const { leadsGenerated, customersAcquired, revenueGenerated } = await computeCampaignRoi(c.utmCampaign);
      return {
        id: c.id,
        name: c.name,
        channel: c.channel as MarketingChannel,
        status: c.status as CampaignStatusValue,
        utmCampaign: c.utmCampaign,
        spend: c.spend,
        startDate: c.startDate ? c.startDate.toISOString() : null,
        endDate: c.endDate ? c.endDate.toISOString() : null,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        leadsGenerated,
        customersAcquired,
        revenueGenerated,
        costPerLead: leadsGenerated > 0 ? Math.round(c.spend / leadsGenerated) : null,
        costPerCustomer: customersAcquired > 0 ? Math.round(c.spend / customersAcquired) : null,
        roi: c.spend > 0 ? (revenueGenerated - c.spend) / c.spend : null,
      };
    })
  );
}

export async function createCampaign(input: {
  name: string;
  channel: MarketingChannel;
  utmCampaign: string | null;
  spend: number;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  createdById: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (input.utmCampaign) {
    const existing = await db().marketingCampaign.findUnique({ where: { utmCampaign: input.utmCampaign } });
    if (existing) return { ok: false, error: "A campaign with that UTM campaign value already exists." };
  }
  const created = await db().marketingCampaign.create({
    data: {
      name: input.name,
      channel: input.channel,
      utmCampaign: input.utmCampaign,
      spend: input.spend,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
      createdById: input.createdById,
    },
  });
  await db().auditLog.create({ data: { adminUserId: input.createdById, action: "marketing_campaign.created", entityType: "MarketingCampaign", entityId: created.id, after: { name: created.name } } });
  return { ok: true, id: created.id };
}

export async function updateCampaign(
  id: string,
  input: Partial<{ name: string; channel: MarketingChannel; status: CampaignStatusValue; utmCampaign: string | null; spend: number; startDate: Date | null; endDate: Date | null; notes: string | null }>,
  adminUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().marketingCampaign.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Campaign not found" };
  if (input.utmCampaign && input.utmCampaign !== existing.utmCampaign) {
    const clash = await db().marketingCampaign.findUnique({ where: { utmCampaign: input.utmCampaign } });
    if (clash && clash.id !== id) return { ok: false, error: "A campaign with that UTM campaign value already exists." };
  }
  await db().marketingCampaign.update({ where: { id }, data: input });
  await db().auditLog.create({ data: { adminUserId, action: "marketing_campaign.updated", entityType: "MarketingCampaign", entityId: id, after: input } });
  return { ok: true };
}

export interface PostListItem {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  channel: MarketingChannel;
  caption: string;
  mediaUrl: string | null;
  videoUrl: string | null;
  status: PostStatusValue;
  scheduledFor: string | null;
  postedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  approvedByName: string | null;
  socialConnectionId: string | null;
  connectedAccountName: string | null;
  platformPostId: string | null;
  publishError: string | null;
}

export async function listPosts(): Promise<PostListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const posts = await db().marketingPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { name: true } }, createdBy: { select: { name: true } }, approvedBy: { select: { name: true } }, socialConnection: { select: { accountName: true } } },
  });
  return posts.map((p) => ({
    id: p.id,
    campaignId: p.campaignId,
    campaignName: p.campaign?.name ?? null,
    channel: p.channel as MarketingChannel,
    caption: p.caption,
    mediaUrl: p.mediaUrl,
    videoUrl: p.videoUrl,
    status: p.status as PostStatusValue,
    scheduledFor: p.scheduledFor ? p.scheduledFor.toISOString() : null,
    postedAt: p.postedAt ? p.postedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    createdByName: p.createdBy?.name ?? null,
    approvedByName: p.approvedBy?.name ?? null,
    socialConnectionId: p.socialConnectionId,
    connectedAccountName: p.socialConnection?.accountName ?? null,
    platformPostId: p.platformPostId,
    publishError: p.publishError,
  }));
}

export async function createPost(input: {
  campaignId: string | null;
  channel: MarketingChannel;
  caption: string;
  mediaUrl: string | null;
  videoUrl: string | null;
  socialConnectionId: string | null;
  scheduledFor: Date | null;
  createdById: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const created = await db().marketingPost.create({
    data: {
      campaignId: input.campaignId,
      channel: input.channel,
      caption: input.caption,
      mediaUrl: input.mediaUrl,
      videoUrl: input.videoUrl,
      socialConnectionId: input.socialConnectionId,
      scheduledFor: input.scheduledFor,
      createdById: input.createdById,
      status: "DRAFT",
    },
  });
  await db().auditLog.create({ data: { adminUserId: input.createdById, action: "marketing_post.created", entityType: "MarketingPost", entityId: created.id } });
  return { ok: true, id: created.id };
}

export async function approvePost(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await db().marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status !== "DRAFT") return { ok: false, error: "Only draft posts can be approved" };
  await db().marketingPost.update({ where: { id }, data: { status: "APPROVED", approvedById: adminUserId } });
  await db().auditLog.create({ data: { adminUserId, action: "marketing_post.approved", entityType: "MarketingPost", entityId: id } });
  return { ok: true };
}

/** Manual fallback: the admin actually publishes the post themselves on the real platform (or
 *  on a channel with no live connection yet), then marks it posted here -- this path never
 *  calls any platform API itself. Prefer publishPost() below when a real connection exists. */
export async function markPostPosted(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await db().marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status !== "APPROVED") return { ok: false, error: "Only approved posts can be marked posted" };
  await db().marketingPost.update({ where: { id }, data: { status: "POSTED", postedAt: new Date() } });
  await db().auditLog.create({ data: { adminUserId, action: "marketing_post.posted", entityType: "MarketingPost", entityId: id } });
  return { ok: true };
}

/** Real automated publish, via the post's attached SocialConnection. Never marks a post POSTED
 *  unless the platform's own API genuinely accepted it -- a failed call leaves the post
 *  APPROVED with a real, visible publishError, so nothing silently "looks posted" when it isn't. */
export async function publishPost(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string; platformPostId?: string }> {
  const post = await db().marketingPost.findUnique({ where: { id }, include: { socialConnection: true } });
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status !== "APPROVED") return { ok: false, error: "Only approved posts can be published" };
  if (!post.socialConnection) return { ok: false, error: "No connected account is attached to this post. Connect one under Marketing Studio → Connected accounts, or use Mark posted after publishing it yourself." };

  const { publishToFacebookPage, publishToInstagram } = await import("./social/meta");
  const connection = post.socialConnection;
  let result: { ok: true; postId: string } | { ok: false; error: string };

  if (post.channel === "META_FACEBOOK") {
    result = await publishToFacebookPage(connection.accountId, connection.accessToken, post.caption, post.mediaUrl);
  } else if (post.channel === "META_INSTAGRAM") {
    if (!post.mediaUrl) result = { ok: false, error: "Instagram requires an image -- add one to this post first." };
    else result = await publishToInstagram(connection.accountId, connection.accessToken, post.caption, post.mediaUrl);
  } else {
    result = { ok: false, error: `Automated publishing to ${post.channel} isn't built yet -- the account is connected, but posting through it is a separate next step.` };
  }

  if (!result.ok) {
    await db().marketingPost.update({ where: { id }, data: { publishError: result.error } });
    await db().auditLog.create({ data: { adminUserId, action: "marketing_post.publish_failed", entityType: "MarketingPost", entityId: id, after: { error: result.error } } });
    return { ok: false, error: result.error };
  }

  await db().marketingPost.update({ where: { id }, data: { status: "POSTED", postedAt: new Date(), platformPostId: result.postId, publishError: null } });
  await db().auditLog.create({ data: { adminUserId, action: "marketing_post.published", entityType: "MarketingPost", entityId: id, after: { platformPostId: result.postId } } });
  return { ok: true, platformPostId: result.postId };
}

export async function cancelPost(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await db().marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status === "POSTED") return { ok: false, error: "A posted post can't be cancelled" };
  await db().marketingPost.update({ where: { id }, data: { status: "CANCELLED" } });
  await db().auditLog.create({ data: { adminUserId, action: "marketing_post.cancelled", entityType: "MarketingPost", entityId: id } });
  return { ok: true };
}

/**
 * Real hard delete, only for a post that never got past DRAFT -- once a post is APPROVED it's
 * had a real human sign-off (and may already be scheduled), so cancelPost()'s soft CANCELLED
 * status is the right tool there instead; a draft the admin doesn't like just goes away. Also
 * removes the underlying database-stored image/video row(s), not just the post that pointed to
 * them, so a rejected AI-generated draft doesn't leave orphaned bytes behind.
 */
export async function deletePost(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await db().marketingPost.findUnique({ where: { id } });
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status !== "DRAFT") return { ok: false, error: "Only draft posts can be deleted -- cancel an approved post instead." };

  await db().marketingPost.delete({ where: { id } });
  for (const url of [post.mediaUrl, post.videoUrl]) {
    const fileId = url?.match(/^\/api\/files\/([a-f0-9]{32})$/)?.[1];
    if (fileId) await db().storedFile.delete({ where: { id: fileId } }).catch(() => {});
  }
  await db().auditLog.create({ data: { adminUserId, action: "marketing_post.deleted", entityType: "MarketingPost", entityId: id } });
  return { ok: true };
}

export async function deleteCampaign(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().marketingCampaign.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Campaign not found" };
  const postCount = await db().marketingPost.count({ where: { campaignId: id } });
  if (postCount > 0) return { ok: false, error: "Remove or reassign this campaign's posts before deleting it." };
  await db().marketingCampaign.delete({ where: { id } });
  await db().auditLog.create({ data: { adminUserId, action: "marketing_campaign.deleted", entityType: "MarketingCampaign", entityId: id } });
  return { ok: true };
}
