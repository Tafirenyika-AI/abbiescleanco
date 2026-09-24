import { Building2 } from "lucide-react";
import ComingSoonModule from "@/components/admin/ComingSoonModule";

export default function AdminPropertyManagersPage() {
  return (
    <ComingSoonModule
      icon={Building2}
      title="Property Managers"
      tagline="A dedicated portal for property managers handling turnovers across multiple units."
      blocked={{
        reason: "No property-manager relationships to build for yet.",
        detail: "This is real, buildable code, but building it out before you have an actual property-manager client to test it against risks guessing wrong about what they'd need. Flag when you have one lined up.",
      }}
      capabilities={[
        "Manage multiple properties and their turnover schedules in one view",
        "Service-level agreements and consolidated invoicing across properties",
        "Permission-scoped access, a property manager sees only their own portfolio",
        "Service history and reports per property",
      ]}
    />
  );
}
