-- Additive only. Adds a real "first sent" timestamp to Quote so admins can see exactly when a
-- quote was sent, without touching any existing column or row relationship.

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

-- Backfill from real history: the audit log already recorded every quote.status_changed event,
-- including the transition to SENT, before this column existed. Use the EARLIEST such event per
-- quote (a quote may have been sent, then later cancelled/declined -- the first SENT is still the
-- real "when did we send this" answer) so existing quotes show honest history instead of a blank
-- field. Quotes with no such audit log entry (e.g. sent before audit logging existed on this
-- action) are correctly left NULL rather than guessed.
UPDATE "quotes" q
SET "sentAt" = sub.first_sent
FROM (
  SELECT "entityId", MIN("createdAt") AS first_sent
  FROM "audit_logs"
  WHERE "entityType" = 'quote'
    AND "action" = 'quote.status_changed'
    AND "after"->>'status' = 'SENT'
  GROUP BY "entityId"
) sub
WHERE q.id = sub."entityId" AND q."sentAt" IS NULL;
