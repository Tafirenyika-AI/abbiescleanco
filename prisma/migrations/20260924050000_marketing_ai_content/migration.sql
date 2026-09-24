-- AI-generated content: a post can carry a real video asset URL alongside its image, for the
-- browser-assembled promo slideshow feature (reference/download only -- no publish API uses it).

ALTER TABLE "marketing_posts" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
