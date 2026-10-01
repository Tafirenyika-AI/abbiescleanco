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
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg">
              <Mail className="size-4" aria-hidden /> Email
            </a>
          )}
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
  const { showToast } = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !json?.ok) return showToast(json?.error || "Couldn't save", "error");
    showToast("Contact info updated.", "success");
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-admin-text">Contact</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-admin-teal-hover hover:underline">Edit</button>
          )}
        </div>
        {editing ? (
          <div className="mt-3 space-y-2.5">
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Email (optional -- leave blank if they don&apos;t have one)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-admin-text-muted">Phone</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={save} disabled={saving || !phone.trim()} className="ios-press flex items-center gap-1.5 rounded-lg bg-admin-teal px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60">
                {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Save
              </button>
              <button type="button" onClick={() => { setEditing(false); setEmail(customer.email ?? ""); setPhone(customer.phone); }} className="ios-press rounded-lg border border-admin-border px-3.5 py-1.5 text-sm font-semibold text-admin-text hover:bg-admin-bg">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Email</dt><dd className="text-admin-text">{customer.email || <span className="text-admin-text-muted">Not on file</span>}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-admin-text-muted">Phone</dt><dd className="text-admin-text">{customer.phone}</dd></div>
          </dl>
        )}
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

interface AddressFormValues {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
}

function emptyAddressForm(): AddressFormValues {
  return { label: "", line1: "", line2: "", city: "", state: "", zip: "", propertyType: "house" };
}

function AddressForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: AddressFormValues;
  saving: boolean;
  onSave: (values: AddressFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const canSave = form.line1.trim().length >= 3 && form.city.trim().length > 0 && form.state.trim().length > 0 && /^\d{5}(-\d{4})?$/.test(form.zip.trim());

  return (
    <div className="space-y-2.5">
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">Company / nickname (optional)</span>
        <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">Address line 1</span>
        <input value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">Address line 2 (optional)</span>
        <input value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">City</span>
          <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">State</span>
          <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-admin-text-muted">ZIP</span>
          <input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-admin-text-muted">Property type</span>
        <select
          value={form.propertyType}
          onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-admin-border px-2.5 py-1.5 text-sm text-admin-text capitalize"
        >
          <option value="house">House</option>
          <option value="apartment">Apartment</option>
          <option value="townhome">Townhome</option>
          <option value="commercial">Commercial</option>
        </select>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !canSave}
          className="ios-press flex items-center gap-1.5 rounded-lg bg-admin-teal px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-admin-teal-hover disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} Save
        </button>
        <button type="button" onClick={onCancel} className="ios-press rounded-lg border border-admin-border px-3.5 py-1.5 text-sm font-semibold text-admin-text hover:bg-admin-bg">
          Cancel
        </button>
      </div>
    </div>
  );
}

function PropertiesTab({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createAddress(form: AddressFormValues) {
    setSaving(true);
    const res = await fetch(`/api/admin/customers/${customer.id}/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, label: form.label.trim() || null, line2: form.line2.trim() || null }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !json?.ok) return showToast(json?.error || "Couldn't add property", "error");
    showToast("Property added.", "success");
    setAddingNew(false);
    router.refresh();
  }

  async function saveAddress(addressId: string, form: AddressFormValues) {
    setSaving(true);
    const res = await fetch(`/api/admin/customers/${customer.id}/addresses/${addressId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, label: form.label.trim() || null, line2: form.line2.trim() || null }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !json?.ok) return showToast(json?.error || "Couldn't save property", "error");
    showToast("Property updated.", "success");
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!addingNew && (
          <button type="button" onClick={() => setAddingNew(true)} className="ios-press rounded-lg border border-admin-border px-3.5 py-1.5 text-sm font-semibold text-admin-text hover:bg-admin-bg">
            + Add property
          </button>
        )}
      </div>

      {addingNew && (
        <Card>
          <h2 className="font-semibold text-admin-text">New property</h2>
          <div className="mt-3">
            <AddressForm initial={emptyAddressForm()} saving={saving} onCancel={() => setAddingNew(false)} onSave={createAddress} />
          </div>
        </Card>
      )}

      {customer.addresses.length === 0 && !addingNew ? (
        <Card><EmptyState title="No properties on file" description="Addresses appear here once collected from a quote request or booking, or add one directly." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {customer.addresses.map((a) =>
            editingId === a.id ? (
              <Card key={a.id}>
                <h2 className="font-semibold text-admin-text">Edit property</h2>
                <div className="mt-3">
                  <AddressForm
                    initial={{ label: a.label ?? "", line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, zip: a.zip, propertyType: a.propertyType }}
                    saving={saving}
                    onCancel={() => setEditingId(null)}
                    onSave={(form) => saveAddress(a.id, form)}
                  />
                </div>
              </Card>
            ) : (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {a.label && <p className="text-sm font-semibold text-admin-text">{a.label}</p>}
                    <p className="font-medium text-admin-text">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                    <p className="text-sm text-admin-text-muted">{a.city}, {a.state} {a.zip}</p>
                    <Badge tone="neutral" className="mt-2 capitalize">{a.propertyType}</Badge>
                  </div>
                  <button type="button" onClick={() => setEditingId(a.id)} className="shrink-0 text-xs font-semibold text-admin-teal-hover hover:underline">
                    Edit
                  </button>
                </div>
              </Card>
            )
          )}
        </div>
      )}
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
    const data = await res.json().catch(() => null);
    setDeleting(false);
    setConfirmDelete(false);
    if (!res.ok || !data?.ok) {
      showToast(data?.error || "Couldn't delete customer", "error");
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
