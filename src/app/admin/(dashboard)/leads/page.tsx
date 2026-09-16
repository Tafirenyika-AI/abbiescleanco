import { listLeads } from "@/lib/server/leadStore";
import { services } from "@/lib/data/services";

export default async function AdminLeadsPage() {
  const leads = await listLeads();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-950">Leads</h1>
      <p className="mt-1 text-sm text-surface-700">{leads.length} total</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-surface-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface-50">
            <tr>
              <th scope="col" className="p-3.5 font-semibold text-navy-950">Reference</th>
              <th scope="col" className="p-3.5 font-semibold text-navy-950">Customer</th>
              <th scope="col" className="p-3.5 font-semibold text-navy-950">Service</th>
              <th scope="col" className="p-3.5 font-semibold text-navy-950">Estimate</th>
              <th scope="col" className="p-3.5 font-semibold text-navy-950">Contact pref.</th>
              <th scope="col" className="p-3.5 font-semibold text-navy-950">Received</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-surface-700">
                  No leads yet. Submit a test request from the Estimate page to see it appear here.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.reference} className="border-t border-surface-100">
                <td className="p-3.5 font-medium text-navy-950">{lead.reference}</td>
                <td className="p-3.5 text-navy-900">
                  {lead.input.firstName} {lead.input.lastName}
                  <div className="text-xs text-surface-700">{lead.input.email} · {lead.input.phone}</div>
                </td>
                <td className="p-3.5 text-navy-900">
                  {services.find((s) => s.id === lead.input.service)?.name ?? lead.input.service}
                </td>
                <td className="p-3.5 text-navy-900">
                  {lead.estimate.requiresManualQuote
                    ? "Manual quote"
                    : `$${lead.estimate.totalLow}–$${lead.estimate.totalHigh}`}
                </td>
                <td className="p-3.5 text-navy-900">{lead.input.preferredContactMethod}</td>
                <td className="p-3.5 text-surface-700">{new Date(lead.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-surface-700">
        Status changes, notes, quote creation, and lost-reason tracking are part of Phase 3 of the
        implementation roadmap — see README.md.
      </p>
    </div>
  );
}
