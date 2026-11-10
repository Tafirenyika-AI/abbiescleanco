-- A real, persistent Stripe Payment Link covering one or more invoices in a single charge.
-- Purely additive: new enum + new table, no changes to existing columns.

CREATE TYPE "InvoicePaymentLinkStatus" AS ENUM ('PENDING', 'PAID', 'VOID');

CREATE TABLE "invoice_payment_links" (
    "id" TEXT NOT NULL,
    "invoiceIds" TEXT[] NOT NULL,
    "items" JSONB NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "InvoicePaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "url" TEXT NOT NULL,
    "stripePaymentLinkId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payment_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_payment_links_stripePaymentLinkId_key" ON "invoice_payment_links"("stripePaymentLinkId");

CREATE INDEX "invoice_payment_links_status_idx" ON "invoice_payment_links"("status");

ALTER TABLE "invoice_payment_links" ADD CONSTRAINT "invoice_payment_links_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
