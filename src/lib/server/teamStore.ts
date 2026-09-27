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

interface StaffJobCountRow { name: string; total: bigint; completed: bigint }

export async function listTeamMembers(): Promise<TeamMemberItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const members = await prisma.teamMember.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });

  // staffAssignee is free-text (no real FK until staff accounts exist -- see schema comment), so this
  // is a grouped DB aggregate rather than pulling every booking ever assigned into memory to
  // string-match in JS, which only got slower as the booking table grew.
  const counts = await prisma.$queryRaw<StaffJobCountRow[]>`
    SELECT LOWER(TRIM("staffAssignee")) AS name,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
    FROM bookings
    WHERE "deletedAt" IS NULL AND "staffAssignee" IS NOT NULL
    GROUP BY LOWER(TRIM("staffAssignee"))
  `;
  const countsByName = new Map(counts.map((c) => [c.name, c]));

  return members.map((m) => {
    const row = countsByName.get(m.name.trim().toLowerCase());
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
      assignedJobs: row ? Number(row.total) : 0,
      completedJobs: row ? Number(row.completed) : 0,
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
