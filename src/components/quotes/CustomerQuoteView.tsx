import { formatQuotedRate, formatFrequency } from "@/lib/quotePricing";

/**
 * The ONE presentational surface for "what the customer sees," used both by the admin builder's
 * "Preview Quote" (so Preview can never show something different from what actually gets sent) and
 * the real customer account portal view. Pure/presentational, read-only, no fetching or mutation --
 * Accept/Decline stays owned by each caller (the account portal's existing accept/decline+reason
 * flow is untouched; the admin preview renders this with no actions at all). Never pass
 * internalNotes here -- there is no prop for it, by design.
 */

export interface CustomerQuoteItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
  pricingUnit: string | null;
  frequency: string | null;
  customFrequency: string | null;
}

export interface CustomerQuoteData {
  quoteNumber: string;
  revisionNumber: number;
  status: string;
  createdAt?: string | null;
  expiresAt: string | null;
  customerName?: string | null;
  companyName: string | null;
  serviceAddress: string | null;
  serviceName: string;
  approxSquareFeet?: number | null;
  items: CustomerQuoteItem[];
  discount: number;
  tax: number;
  deposit: number;
  total: number;
  scopeOfService: string | null;
  exclusions: string | null;
  notes: string | null; // "Customer Notes / Terms"
  customerMessage: string | null;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function CustomerQuoteView({ quote }: { quote: CustomerQuoteData }) {
  const serviceItems = quote.items.filter((i) => i.pricingUnit);
  const plainItems = quote.items.filter((i) => !i.pricingUnit);
  const hasServiceLine = serviceItems.length > 0;

  return (
    <div className="mx-auto max-w-xl text-navy-950">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-700">Abbie&apos;s Clean Method LLC</p>
        <h1 className="mt-1 text-xl font-semibold">Commercial Cleaning Quotation</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-surface-700">
          <span>
            Quote {quote.quoteNumber}
            {quote.revisionNumber > 1 ? ` · Revision ${quote.revisionNumber}` : ""}
          </span>
          {quote.createdAt && <span>· Prepared {new Date(quote.createdAt).toLocaleDateString("en-US")}</span>}
          {quote.expiresAt && <span>· Valid until {new Date(quote.expiresAt).toLocaleDateString("en-US")}</span>}
        </div>
      </header>

      {(quote.customerName || quote.companyName || quote.serviceAddress) && (
        <section className="mt-6 rounded-2xl border border-surface-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-700">Prepared For</h2>
          {quote.customerName && <p className="mt-1.5 font-medium">{quote.customerName}</p>}
          {quote.companyName && <p className="text-sm text-surface-700">{quote.companyName}</p>}
          {quote.serviceAddress && <p className="text-sm text-surface-700">{quote.serviceAddress}</p>}
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-surface-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-700">Service Details</h2>
        <dl className="mt-1.5 space-y-1 text-sm">
          <div><dt className="inline text-surface-700">Service: </dt><dd className="inline font-medium">{quote.serviceName}</dd></div>
          {quote.approxSquareFeet ? (
            <div><dt className="inline text-surface-700">Facility: </dt><dd className="inline font-medium">Approx. {quote.approxSquareFeet.toLocaleString("en-US")} sq. ft.</dd></div>
          ) : null}
        </dl>
      </section>

      <section className="mt-4 rounded-2xl border border-surface-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-700">Service Pricing</h2>
        {serviceItems.length > 0 && (
          <ul className="mt-2 space-y-3">
            {serviceItems.map((i) => {
              const freq = formatFrequency(i.frequency, i.customFrequency);
              return (
                <li key={i.id}>
                  <p className="font-medium">{i.label}</p>
                  {freq && <p className="text-sm text-surface-700">{freq}</p>}
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-teal-700">{formatQuotedRate(i.unitPrice, i.pricingUnit).toUpperCase()}</p>
                </li>
              );
            })}
          </ul>
        )}
        {plainItems.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {plainItems.map((i) => (
                <tr key={i.id}><td className="py-1">{i.label}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</td><td className="py-1 text-right">{money(i.total)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {/* A combined dollar total/discount/tax is only shown when it means something real -- once
            any line is a recurring rate, summing it with other lines would misrepresent a contract
            value this project's quoting rules explicitly forbid implying. */}
        {!hasServiceLine && (
          <dl className="mt-2 space-y-1 text-sm">
            {quote.discount > 0 && <div className="flex justify-between"><dt className="text-surface-700">Discount</dt><dd>-{money(quote.discount)}</dd></div>}
            {quote.tax > 0 && <div className="flex justify-between"><dt className="text-surface-700">Tax</dt><dd>{money(quote.tax)}</dd></div>}
            <div className="flex justify-between border-t border-surface-200 pt-1 font-semibold"><dt>Total</dt><dd>{money(quote.total)}</dd></div>
          </dl>
        )}
        {quote.deposit > 0 && <p className="mt-2 text-sm text-surface-700">Deposit to confirm: {money(quote.deposit)}</p>}
      </section>

      {quote.scopeOfService?.trim() && (
        <section className="mt-4 rounded-2xl border border-surface-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-700">Scope of Service</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm">{quote.scopeOfService.trim()}</p>
        </section>
      )}

      {quote.exclusions?.trim() && (
        <section className="mt-4 rounded-2xl border border-surface-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-700">Exclusions / Special Conditions</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm">{quote.exclusions.trim()}</p>
        </section>
      )}

      {quote.notes?.trim() && (
        <section className="mt-4 rounded-2xl border border-surface-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-700">Customer Notes / Terms</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm">{quote.notes.trim()}</p>
        </section>
      )}

      {quote.customerMessage?.trim() && (
        <p className="mt-5 text-center text-sm italic text-surface-700">{quote.customerMessage.trim()}</p>
      )}
    </div>
  );
}
