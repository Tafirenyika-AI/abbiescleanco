import { listTeamMembers } from "@/lib/server/teamStore";
import TeamView from "@/components/admin/team/TeamView";

export default async function AdminTeamPage() {
  const members = await listTeamMembers();
  return <TeamView initialMembers={members} />;
}
