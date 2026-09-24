import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Customer accounts require a real database — unlike leads/pricing there's
 * no meaningful "mock mode" for a persistent login (a session tied to a
 * user row that vanishes on restart isn't useful to demo). Every function
 * here throws AccountsUnavailableError when DATABASE_URL isn't set; callers
 * turn that into a 503 with a clear message.
 */
export class AccountsUnavailableError extends Error {
  constructor() {
    super("Accounts require DATABASE_URL to be configured.");
    this.name = "AccountsUnavailableError";
  }
}

function db() {
  if (!isDatabaseConfigured || !prisma) throw new AccountsUnavailableError();
  return prisma;
}

export interface PublicProfile {
  id: string;
  email: string;
  name: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
}

function toPublicProfile(user: {
  id: string;
  email: string;
  name: string | null;
  customer: { id: string; firstName: string; lastName: string; phone: string } | null;
}): PublicProfile {
  return { id: user.id, email: user.email, name: user.name, customer: user.customer };
}

export async function signUp(input: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
  const existing = await db().user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing?.passwordHash) {
    return { ok: false as const, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const name = `${input.firstName} ${input.lastName}`.trim();

  const user = existing
    ? await db().user.update({
        where: { id: existing.id },
        data: { passwordHash, name },
        include: { customer: true },
      })
    : await db().user.create({
        data: { email: input.email.toLowerCase(), name, passwordHash },
        include: { customer: true },
      });

  if (!user.customer) {
    await db().customer.create({
      data: {
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone || "",
      },
    });
  }

  return { ok: true as const, userId: user.id };
}

export async function verifyLogin(email: string, password: string): Promise<PublicProfile | null> {
  const user = await db().user.findUnique({ where: { email: email.toLowerCase() }, include: { customer: true } });
  if (!user || !user.passwordHash) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return toPublicProfile(user);
}

export async function getProfile(userId: string): Promise<PublicProfile | null> {
  const user = await db().user.findUnique({ where: { id: userId }, include: { customer: true } });
  if (!user) return null;
  return toPublicProfile(user);
}

export async function updateProfile(userId: string, input: { name?: string; firstName?: string; lastName?: string; phone?: string }) {
  const user = await db().user.findUnique({ where: { id: userId }, include: { customer: true } });
  if (!user) throw new Error("Account not found");

  if (input.name !== undefined) {
    await db().user.update({ where: { id: userId }, data: { name: input.name } });
  }
  if (user.customer && (input.firstName !== undefined || input.lastName !== undefined || input.phone !== undefined)) {
    await db().customer.update({
      where: { id: user.customer.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const user = await db().user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) return false;
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return false;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db().user.update({ where: { id: userId }, data: { passwordHash } });
  return true;
}

/** Always succeeds from the caller's perspective (never reveals whether an email exists). */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await db().user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db().user.update({ where: { id: user.id }, data: { resetToken: token, resetTokenExpiresAt } });
  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const user = await db().user.findUnique({ where: { resetToken: token } });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db().user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });
  return true;
}

/**
 * Called from the estimate wizard's success screen: turns the guest lead
 * just submitted (identified by email) into a real account, without asking
 * the customer to re-type anything already collected.
 */
export async function claimAccountFromLead(email: string, password: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const customer = await db().customer.findFirst({ where: { email: email.toLowerCase() }, orderBy: { createdAt: "desc" } });
  if (!customer) return { ok: false, error: "We couldn't find a recent request for that email." };

  if (customer.userId) {
    const existingUser = await db().user.findUnique({ where: { id: customer.userId } });
    if (existingUser?.passwordHash) return { ok: false, error: "An account already exists for this email, sign in instead." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db().user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, name: `${customer.firstName} ${customer.lastName}`.trim() },
    create: { email: email.toLowerCase(), name: `${customer.firstName} ${customer.lastName}`.trim(), passwordHash },
  });

  if (!customer.userId) {
    await db().customer.update({ where: { id: customer.id }, data: { userId: user.id } });
  }

  return { ok: true, userId: user.id };
}
