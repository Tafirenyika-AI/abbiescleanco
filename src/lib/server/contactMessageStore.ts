import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Messages require DATABASE_URL to be configured.");
  return prisma;
}

export const CONTACT_MESSAGE_STATUSES = ["NEW", "READ", "RESPONDED", "ARCHIVED"] as const;
export type ContactMessageStatusValue = (typeof CONTACT_MESSAGE_STATUSES)[number];

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  isUrgent: boolean;
  status: ContactMessageStatusValue;
  createdAt: string;
}

function map(m: {
  id: string; name: string; email: string; phone: string | null; message: string;
  isUrgent: boolean; status: string; createdAt: Date;
}): ContactMessageItem {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    message: m.message,
    isUrgent: m.isUrgent,
    status: m.status as ContactMessageStatusValue,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function createContactMessage(data: { name: string; email: string; phone?: string; message: string; isUrgent: boolean }): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  await prisma.contactMessage.create({
    data: { name: data.name, email: data.email, phone: data.phone || null, message: data.message, isUrgent: data.isUrgent },
  });
}

export async function listContactMessages(): Promise<ContactMessageItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return rows.map(map);
}

export async function countNewContactMessages(): Promise<number> {
  if (!isDatabaseConfigured || !prisma) return 0;
  return prisma.contactMessage.count({ where: { status: "NEW" } });
}

export async function setContactMessageStatus(id: string, status: ContactMessageStatusValue): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().contactMessage.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Message not found" };
  await db().contactMessage.update({ where: { id }, data: { status } });
  return { ok: true };
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  const existing = await db().contactMessage.findUnique({ where: { id } });
  if (!existing) return false;
  await db().contactMessage.delete({ where: { id } });
  return true;
}
