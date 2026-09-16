import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Team requires DATABASE_URL to be configured.");
  return prisma;
}

export interface TeamMemberItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  qualifications: string[];
  workingHours: string | null;
  isActive: boolean;
  notes: string | null;
  assignedJobs: number;
  completedJobs: number;
}

export async function listTeamMembers(): Promise<TeamMemberItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const members = await prisma.teamMember.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  const bookings = await prisma.booking.findMany({ where: { deletedAt: null, staffAssignee: { not: null } }, select: { staffAssignee: true, status: true } });

  return members.map((m) => {
    const matching = bookings.filter((b) => b.staffAssignee?.trim().toLowerCase() === m.name.trim().toLowerCase());
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      role: m.role,
      qualifications: m.qualifications,
      workingHours: m.workingHours,
      isActive: m.isActive,
      notes: m.notes,
      assignedJobs: matching.length,
      completedJobs: matching.filter((b) => b.status === "COMPLETED").length,
    };
  });
}

export async function createTeamMember(data: { name: string; email?: string; phone?: string; role?: string; qualifications?: string[]; workingHours?: string }) {
  return db().teamMember.create({ data });
}

export async function updateTeamMember(
  id: string,
  data: Partial<{ name: string; email: string; phone: string; role: string; qualifications: string[]; workingHours: string; isActive: boolean; notes: string }>
) {
  await db().teamMember.update({ where: { id }, data });
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const existing = await db().teamMember.findUnique({ where: { id } });
  if (!existing) return false;
  await db().teamMember.update({ where: { id }, data: { deletedAt: new Date() } });
  return true;
}
