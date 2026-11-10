-- Tracks when an invoice was actually emailed to the customer (new "Email to customer" action) --
-- distinct from issueDate (when the invoice record was created). Purely additive, nullable.

ALTER TABLE "invoices" ADD COLUMN "emailedAt" TIMESTAMP(3);
