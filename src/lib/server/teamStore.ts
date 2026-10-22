import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Team requires DATABASE_URL to be configured.");
  return prisma;
}

export interface AssignableTeamMember {
  id: string;
  name: string;
}

/** A trimmed, read-only view for the booking-assignment dropdown -- same reasoning as
 *  subcontractorStore's listAssignableSubcontractors (callers there only have MANAGE_BOOKINGS). */
export async function listAssignableTeamMembers(): Promise<AssignableTeamMember[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  return db().teamMember.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

/** Links a real booking to a real team member, or clears it (pass null). Keeps the existing
 *  free-text staffAssignee field in sync, same pattern as subcontractorStore's
 *  assignBookingToSubcontractor -- see the schema's own comment on Booking.staffAssignee. */
export async function assignBookingToTeamMember(bookingId: string, teamMemberId: string | null): Promise<{ ok: boolean; error?: string }> {
  const booking = await db().booking.findFirst({ where: { id: bookingId, deletedAt: null } });
  if (!booking) return { ok: false, error: "Booking not found" };

  if (teamMemberId === null) {
    await db().booking.update({ where: { id: bookingId }, data: { teamMemberId: null } });
    return { ok: true };
  }
  const member = await db().teamMember.findFirst({ where: { id: teamMemberId, deletedAt: null } });
  if (!member) return { ok: false, error: "Team member not found" };
  await db().booking.update({ where: { id: bookingId }, data: { teamMemberId, staffAssignee: member.name } });
  return { ok: true };
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
interface TeamMemberIdCountRow { id: string; total: bigint; completed: bigint }

export async function listTeamMembers(): Promise<TeamMemberItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const members = await prisma.teamMember.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });

  // Real FK-based counts (bookings assigned via teamMemberId, see assignBookingToTeamMember) plus
  // a fallback name-match aggregate for older bookings assigned before this FK existed -- the
  // fallback explicitly excludes rows that already have a teamMemberId so a booking is never
  // counted twice. Once every booking goes through the real assignment flow, the fallback query
  // will simply return nothing.
  const [fkCounts, nameCounts] = await Promise.all([
    prisma.$queryRaw<TeamMemberIdCountRow[]>`
      SELECT "teamMemberId" AS id,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
      FROM bookings
      WHERE "deletedAt" IS NULL AND "teamMemberId" IS NOT NULL
      GROUP BY "teamMemberId"
    `,
    prisma.$queryRaw<StaffJobCountRow[]>`
      SELECT LOWER(TRIM("staffAssignee")) AS name,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
      FROM bookings
      WHERE "deletedAt" IS NULL AND "staffAssignee" IS NOT NULL AND "teamMemberId" IS NULL
      GROUP BY LOWER(TRIM("staffAssignee"))
    `,
  ]);
  const fkById = new Map(fkCounts.map((c) => [c.id, c]));
  const nameByName = new Map(nameCounts.map((c) => [c.name, c]));

  return members.map((m) => {
    const fk = fkById.get(m.id);
    const legacy = nameByName.get(m.name.trim().toLowerCase());
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
      assignedJobs: Number(fk?.total ?? 0) + Number(legacy?.total ?? 0),
      completedJobs: Number(fk?.completed ?? 0) + Number(legacy?.completed ?? 0),
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
