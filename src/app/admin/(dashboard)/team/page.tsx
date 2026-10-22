import { redirect } from "next/navigation";

// Retired in favor of the unified Workforce page (team roster + subcontractor roster + real job
// assignment, in one place) -- kept as a redirect so any existing bookmark/link still lands
// somewhere real instead of a dead page.
export default function AdminTeamPage() {
  redirect("/admin/workforce");
}
