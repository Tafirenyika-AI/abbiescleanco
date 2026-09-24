import { HardHat } from "lucide-react";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default function AdminWorkforcePage() {
  return (
    <ComingSoonModule
      icon={HardHat}
      title="Workforce & Subcontractors"
      tagline="Onboard cleaners and subcontractors with real logins, documents, and job offers. Goes beyond the name/role roster in Team today."
      blocked={{
        reason: "Needs your decision on how cleaners are classified and paid.",
        detail: "Employee vs. subcontractor classification, insurance/licensing requirements, and pay structure are real legal and financial decisions for this business, not something to guess at in code. See docs/IMPLEMENTATION_PLAN.md Phase 4.",
      }}
      capabilities={[
        "Cleaner login with their own assigned-job view and completion checklist",
        "Subcontractor application, document upload, and insurance/qualification review",
        "Job offers that a cleaner or subcontractor can accept or decline",
        "A CleanPass-style completion report (checklist, timestamps, photos) per job",
      ]}
    />
  );
}
