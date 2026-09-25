-- A real client without email (not tech-savvy) should still be saveable. Email stays required
-- for the public marketing-site quote form (a separate code path, unaffected), but is now
-- optional for a customer created directly by an admin.

ALTER TABLE "customers" ALTER COLUMN "email" DROP NOT NULL;
