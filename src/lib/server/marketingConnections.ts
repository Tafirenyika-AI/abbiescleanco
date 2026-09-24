import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import type { MarketingChannel } from "./marketingStore";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Marketing connections require DATABASE_URL to be configured.");
  return prisma;
}

export interface ConnectionListItem {
  id: string;
  platform: MarketingChannel;
  accountId: string;
  accountName: string;
  tokenExpiresAt: string | null;
  connectedByName: string | null;
  createdAt: string;
}

export async function listConnections(): Promise<ConnectionListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const rows = await db().socialConnection.findMany({ orderBy: { createdAt: "desc" }, include: { connectedBy: { select: { name: true } } } });
  return rows.map((r) => ({
    id: r.id,
    platform: r.platform as MarketingChannel,
    accountId: r.accountId,
    accountName: r.accountName,
    tokenExpiresAt: r.tokenExpiresAt ? r.tokenExpiresAt.toISOString() : null,
    connectedByName: r.connectedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteConnection(id: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().socialConnection.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Connection not found" };
  await db().socialConnection.delete({ where: { id } });
  await db().auditLog.create({
    data: { adminUserId, action: "social_connection.disconnected", entityType: "SocialConnection", entityId: id, before: { platform: existing.platform, accountName: existing.accountName } },
  });
  return { ok: true };
}

export async function upsertConnection(input: {
  platform: MarketingChannel;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  connectedById: string;
}): Promise<void> {
  await db().socialConnection.upsert({
    where: { platform_accountId: { platform: input.platform, accountId: input.accountId } },
    create: {
      platform: input.platform,
      accountId: input.accountId,
      accountName: input.accountName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      connectedById: input.connectedById,
    },
    update: {
      accountName: input.accountName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      connectedById: input.connectedById,
    },
  });
  await db().auditLog.create({
    data: { adminUserId: input.connectedById, action: "social_connection.connected", entityType: "SocialConnection", entityId: `${input.platform}:${input.accountId}`, after: { accountName: input.accountName } },
  });
}
