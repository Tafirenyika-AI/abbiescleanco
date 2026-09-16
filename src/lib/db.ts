import { PrismaClient } from "@prisma/client";

/**
 * Prisma is only wired up when DATABASE_URL is configured. Until then,
 * API routes fall back to the local JSON mock store in
 * src/lib/server/leadStore.ts so the full customer journey can be tested
 * end-to-end without live Postgres/Supabase credentials.
 */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  (isDatabaseConfigured
    ? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] })
    : undefined);

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}
