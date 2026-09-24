"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, Mail, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import type { CustomerDetail } from "@/lib/server/customerStore";
import Card from "@/components/admin/ui/Card";
import Badge from "@/components/admin/ui/Badge";
import EmptyState from "@/components/admin/ui/EmptyState";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDate, formatDateTime } from "@/lib/adminDate";

const tabs = ["Overview", "Properties", "Bookings", "Payments", "Notes & preferences"] as const;
type Tab = (typeof tabs)[number];

export default function CustomerDetailView({ customer }: { customer: CustomerDetail }) {
  const [active, setActive] = useState<Tab>("Overview");
  const fullName = `${customer.firstName} ${customer.lastName}`.trim();

  return (
    <div>
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to customers
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-text sm:text-[28px]">{fullName || "Customer"}</h1>
          <p className="mt-1 text-sm text-admin-text-muted">Customer since {formatDate(customer.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
            <Phone className="size-4" aria-hidden /> Call
          </a>
          <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
            <Mail className="size-4" aria-hidden /> Email
          </a>
        </div>
      </div>

      <div className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-admin-border bg-admin-card p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active === tab ? "bg-admin-navy text-white" : "text-admin-text-muted hover:text-admin-text"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {active === "Overview" && <OverviewTab customer={customer} />}
        {active === "Properties" && <PropertiesTab customer={customer} />}
        {active === "Bookings" && <BookingsTab customer={customer} />}
        {active === "Payments" && <PaymentsTab customer={customer} />}
        {active === "Notes & preferences" && <NotesTab customer={customer} />}
      </div>
    </div>
  );
}

function OverviewTab({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="font-semibold text-admin-text">Contact</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Email</dt><dd className="text-admin-text">{customer.email}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Phone</dt><dd className="text-admin-text">{customer.phone}</dd></div>
        </dl>
      </Card>
      <Card>
        <h2 className="font-semibold text-admin-text">Recent leads</h2>
        {customer.leads.length === 0 ? (
          <p className="mt-2 text-sm text-admin-text-muted">No leads on file.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {customer.leads.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center justify-between text-sm">
                <Link href={`/admin/leads`} className="text-admin-teal-hover hover:underline">{l.reference}</Link>
                <Badge tone="neutral">{l.status.replace(/_/g, " ")}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PropertiesTab({ customer }: { customer: CustomerDetail }) {
  if (customer.addresses.length === 0) {
    return <Card><EmptyState title="No properties on file" description="Addresses appear here once collected from a quote request or booking." /></Card>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {customer.addresses.map((a) => (
        <Card key={a.id}>
          <p className="font-medium text-admin-text">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
          <p className="text-sm text-admin-text-muted">{a.city}, {a.state} {a.zip}</p>
          <Badge tone="neutral" className="mt-2 capitalize">{a.propertyType}</Badge>
        </Card>
      ))}
    </div>
  );
}

function BookingsTab({ customer }: { customer: CustomerDetail }) {
  if (customer.bookings.length === 0) {
    return <Card><EmptyState title="No bookings yet" description="Scheduled and completed cleanings will appear here once the Bookings module is in use." /></Card>;
  }
  return (
    <Card padded={false}>
      <table className="w-full text-left text-sm">
        <thead className="bg-admin-bg"><tr><th className="p-3.5 font-semibold text-admin-text">Reference</th><th className="p-3.5 font-semibold text-admin-text">Status</th><th className="p-3.5 font-semibold text-admin-text">Scheduled</th></tr></thead>
        <tbody>
          {customer.bookings.map((b) => (
            <tr key={b.id} className="border-t border-admin-border">
              <td className="p-3.5 text-admin-text">{b.reference}</td>
              <td className="p-3.5"><Badge tone="neutral">{b.status.replace(/_/g, " ")}</Badge></td>
              <td className="p-3.5 text-admin-text-muted">{b.scheduledStart ? formatDateTime(b.scheduledStart) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PaymentsTab({ customer }: { customer: CustomerDetail }) {
  if (customer.payments.length === 0) {
    return <Card><EmptyState title="No payments yet" description="Deposits and payments will appear here once the Payments module is in use." /></Card>;
  }
  return (
    <Card padded={false}>
      <table className="w-full text-left text-sm">
        <thead className="bg-admin-bg"><tr><th className="p-3.5 font-semibold text-admin-text">Kind</th><th className="p-3.5 font-semibold text-admin-text">Amount</th><th className="p-3.5 font-semibold text-admin-text">Status</th><th className="p-3.5 font-semibold text-admin-text">Date</th></tr></thead>
        <tbody>
          {customer.payments.map((p) => (
            <tr key={p.id} className="border-t border-admin-border">
              <td className="p-3.5 capitalize text-admin-text">{p.kind.replace(/_/g, " ")}</td>
              <td className="p-3.5 text-admin-text">${(p.amount / 100).toFixed(2)}</td>
              <td className="p-3.5"><Badge tone="neutral">{p.status}</Badge></td>
              <td className="p-3.5 text-admin-text-muted">{formatDate(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function NotesTab({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    notes: customer.notes ?? "",
    petsNote: customer.petsNote ?? "",
    accessInstructions: customer.accessInstructions ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("Couldn't save notes", "error");
      return;
    }
    showToast("Saved", "success");
  }

  async function confirmDeleteCustomer() {
    setDeleting(true);
    const res = await fetch(`/api/admin/customers/${customer.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (!res.ok) {
      showToast("Couldn't delete customer", "error");
      return;
    }
    showToast("Customer deleted", "success");
    router.push("/admin/customers");
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card className="sm:col-span-2">
        <h2 className="font-semibold text-admin-text">Internal notes</h2>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          placeholder="General notes about this customer…"
          className="mt-2 w-full rounded-lg border border-admin-border px-3 py-2 text-sm text-admin-text"
        />
      </Card>
      <Card>
        <h2 className="font-semibold text-admin-text">Pets</h2>
        <textarea
          value={form.petsNote}
          onChange={(e) => setForm((f) => ({ ...f, petsNote: e.target.value }))}
          rows={2}
          placeholder="Pet names, temperament, anything the cleaner should know…"
          className="mt-2 w-full rounded-lg border border-admin-border px-3 py-2 text-sm text-admin-text"
        />
      </Card>
      <Card>
        <h2 className="flex items-center gap-1.5 font-semibold text-admin-text">Access instructions <Badge tone="warning">Sensitive</Badge></h2>
        <textarea
          value={form.accessInstructions}
          onChange={(e) => setForm((f) => ({ ...f, accessInstructions: e.target.value }))}
          rows={2}
          placeholder="Gate codes, lockbox location, etc. (never sent by email or analytics)"
          className="mt-2 w-full rounded-lg border border-admin-border px-3 py-2 text-sm text-admin-text"
        />
      </Card>
      <Card className="sm:col-span-2">
        <h2 className="font-semibold text-admin-text">Communication preferences</h2>
        {customer.communicationPreference ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={customer.communicationPreference.emailConsent ? "success" : "neutral"}>
              Email {customer.communicationPreference.emailConsent ? "opted in" : "opted out"}
            </Badge>
            <Badge tone={customer.communicationPreference.smsConsent ? "success" : "neutral"}>
              SMS {customer.communicationPreference.smsConsent ? "opted in" : "opted out"}
            </Badge>
            <Badge tone={customer.communicationPreference.marketingConsent ? "success" : "neutral"}>
              Marketing {customer.communicationPreference.marketingConsent ? "opted in" : "opted out"}
            </Badge>
          </div>
        ) : (
          <p className="mt-2 text-sm text-admin-text-muted">No preferences on file.</p>
        )}
      </Card>
      <div className="flex items-center justify-between sm:col-span-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="ios-press inline-flex items-center gap-2 rounded-lg bg-admin-teal px-4 py-2 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
          Save notes
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-admin-error/30 px-4 py-2 text-sm font-semibold text-admin-error hover:bg-red-50"
        >
          <Trash2 className="size-4" aria-hidden />
          Delete customer
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this customer?"
        description="Their leads, bookings, and payment history stay on record, but they'll no longer appear in your customer list. This can't be undone from here."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        tone="danger"
        onConfirm={confirmDeleteCustomer}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
