import { prisma, isDatabaseConfigured } from "@/lib/db";

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  adminName: string | null;
  createdAt: string;
}

export async function listAuditLogs(filter: { entityType?: string } = {}): Promise<AuditLogItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const logs = await prisma.auditLog.findMany({
    where: filter.entityType ? { entityType: filter.entityType } : undefined,
    include: { adminUser: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    before: l.before,
    after: l.after,
    adminName: l.adminUser?.name ?? null,
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function listAuditEntityTypes(): Promise<string[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const rows = await prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } });
  return rows.map((r) => r.entityType).sort();
}
