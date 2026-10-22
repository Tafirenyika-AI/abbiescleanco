import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { getAdminProfile, hasPermission } from "@/lib/server/adminUsers";
import { listTeamMembers } from "@/lib/server/teamStore";
import { listSubcontractorsForWorkforce } from "@/lib/server/subcontractorStore";
import { listUpcomingJobsForWorker } from "@/lib/server/bookingStore";
import WorkforceManager from "@/components/admin/workforce/WorkforceManager";

export default async function AdminWorkforcePage() {
  const cookieStore = await cookies();
  const session = verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const admin = session ? await getAdminProfile(session.adminUserId) : null;

  if (!admin || !hasPermission(admin, "MANAGE_USERS")) {
    redirect("/admin");
  }

  // Subcontractor pay/tax detail stays gated on FINANCE_SUBCONTRACTORS (see
  // listSubcontractorsForWorkforce's own comment) -- an admin without it still sees the roster
  // here (name/status/job counts, no figures) but can't create a new one or see what they're paid.
  const canManageSubcontractorPay = hasPermission(admin, "FINANCE_SUBCONTRACTORS");

  const [teamMembers, subcontractors] = await Promise.all([
    listTeamMembers(),
    listSubcontractorsForWorkforce(),
  ]);

  const [teamWithJobs, subcontractorsWithJobs] = await Promise.all([
    Promise.all(teamMembers.map(async (m) => ({ ...m, upcomingJobs: await listUpcomingJobsForWorker({ teamMemberId: m.id }) }))),
    Promise.all(subcontractors.map(async (s) => ({ ...s, upcomingJobs: await listUpcomingJobsForWorker({ subcontractorId: s.id }) }))),
  ]);

  return (
    <WorkforceManager
      initialTeam={teamWithJobs}
      initialSubcontractors={subcontractorsWithJobs}
      canManageSubcontractorPay={canManageSubcontractorPay}
    />
  );
}
