-- Additive only: profile picture support for admin users and customers.
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
