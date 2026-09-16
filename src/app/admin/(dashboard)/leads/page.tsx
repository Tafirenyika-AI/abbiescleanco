import { listLeads } from "@/lib/server/leadStore";
import LeadsView from "@/components/admin/leads/LeadsView";

export default async function AdminLeadsPage() {
  const leads = await listLeads();
  return <LeadsView initialLeads={leads} />;
}
