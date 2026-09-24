-- Real OAuth-authorized social/ad platform connections + the MarketingPost fields
-- needed to actually publish through them (mediaUrl, the connection link, and honest
-- platformPostId/publishError proof-of-work fields).

ALTER TABLE "marketing_posts" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "marketing_posts" ADD COLUMN IF NOT EXISTS "socialConnectionId" TEXT;
ALTER TABLE "marketing_posts" ADD COLUMN IF NOT EXISTS "platformPostId" TEXT;
ALTER TABLE "marketing_posts" ADD COLUMN IF NOT EXISTS "publishError" TEXT;

CREATE TABLE IF NOT EXISTS "social_connections" (
    "id" TEXT NOT NULL,
    "platform" "MarketingChannel" NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_platform_accountId_key" ON "social_connections"("platform", "accountId");

DO $$ BEGIN
  ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_posts" ADD CONSTRAINT "marketing_posts_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "social_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
