import { getPricingConfig } from "@/lib/server/pricingStore";
import { isDatabaseConfigured } from "@/lib/db";
import PricingEditor from "@/components/admin/PricingEditor";

export default async function AdminPricingPage() {
  const config = await getPricingConfig();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-950">Pricing</h1>
      <p className="mt-1 text-sm text-surface-700">
        These rates drive every estimate shown on the site — the homepage teaser, the full
        estimate wizard, and the numbers saved with each lead. Changes take effect immediately.
      </p>

      {!isDatabaseConfigured && (
        <p className="mt-3 rounded-xl bg-warm-100 p-3 text-sm text-navy-900">
          No DATABASE_URL is configured — pricing changes save to the local mock store
          (<code>.data/pricing-config.json</code>) instead of Postgres.
        </p>
      )}

      <div className="mt-6">
        <PricingEditor initialConfig={config} />
      </div>
    </div>
  );
}
