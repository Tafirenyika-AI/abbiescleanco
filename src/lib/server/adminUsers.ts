import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { ALL_ADMIN_PERMISSIONS, type AdminPermission, type AdminProfile } from "@/lib/permissions";

export { ALL_ADMIN_PERMISSIONS, permissionLabels, type AdminPermission, type AdminProfile } from "@/lib/permissions";

/** In no-database mode there's exactly one full-access demo admin, matching ADMIN_DEMO_EMAIL/PASSWORD. */
const DEMO_ADMIN_ID = "demo-admin";
function demoAdminProfile(): AdminProfile {
  return {
    id: DEMO_ADMIN_ID,
    email: process.env.ADMIN_DEMO_EMAIL || "admin@abbiescleanco.com",
    name: "Demo Admin",
    role: "Owner",
    permissions: [...ALL_ADMIN_PERMISSIONS],
    isActive: true,
  };
}

export async function verifyAdminCredentials(email: string, password: string): Promise<AdminProfile | null> {
  if (isDatabaseConfigured && prisma) {
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.isActive || admin.deletedAt) return null;
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return null;
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions as AdminPermission[],
      isActive: admin.isActive,
    };
  }

  const demoEmail = process.env.ADMIN_DEMO_EMAIL;
  const demoPassword = process.env.ADMIN_DEMO_PASSWORD;
  if (!demoEmail || !demoPassword) return null;
  if (email.toLowerCase() !== demoEmail.toLowerCase() || password !== demoPassword) return null;
  return demoAdminProfile();
}

export async function getAdminProfile(adminUserId: string): Promise<AdminProfile | null> {
  if (adminUserId === DEMO_ADMIN_ID) return demoAdminProfile();

  if (isDatabaseConfigured && prisma) {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!admin || !admin.isActive || admin.deletedAt) return null;
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions as AdminPermission[],
      isActive: admin.isActive,
    };
  }

  return null;
}

export function hasPermission(admin: AdminProfile | null, permission: AdminPermission): boolean {
  return Boolean(admin?.permissions.includes(permission));
}

export async function listAdminUsers(): Promise<AdminProfile[]> {
  if (!isDatabaseConfigured || !prisma) return [demoAdminProfile()];
  const admins = await prisma.adminUser.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
  return admins.map((a) => ({
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    permissions: a.permissions as AdminPermission[],
    isActive: a.isActive,
  }));
}

export async function createAdminUser(input: { email: string; name: string; password: string; role: string; permissions: AdminPermission[] }) {
  if (!isDatabaseConfigured || !prisma) {
    throw new Error("Creating admin users requires DATABASE_URL to be configured.");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.adminUser.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
      role: input.role,
      permissions: input.permissions,
    },
  });
}

export async function updateAdminUser(
  id: string,
  input: Partial<{ name: string; role: string; permissions: AdminPermission[]; isActive: boolean; password: string }>
) {
  if (!isDatabaseConfigured || !prisma) {
    throw new Error("Updating admin users requires DATABASE_URL to be configured.");
  }
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.permissions !== undefined) data.permissions = input.permissions;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.adminUser.update({ where: { id }, data });
}

/** Always succeeds from the caller's perspective (never reveals whether an admin account exists). */
export async function requestAdminPasswordReset(email: string): Promise<string | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin || !admin.isActive || admin.deletedAt) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.adminUser.update({ where: { id: admin.id }, data: { resetToken: token, resetTokenExpiresAt } });
  return token;
}

export async function resetAdminPassword(token: string, newPassword: string): Promise<boolean> {
  if (!isDatabaseConfigured || !prisma) return false;
  const admin = await prisma.adminUser.findUnique({ where: { resetToken: token } });
  if (!admin || !admin.resetTokenExpiresAt || admin.resetTokenExpiresAt < new Date()) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });
  return true;
}
