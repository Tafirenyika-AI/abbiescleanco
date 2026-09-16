import { promises as fs } from "fs";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export class UploadError extends Error {}

function sanitizeBaseName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
}

/**
 * Stores an admin-uploaded image and returns a public URL for it.
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is configured (the real
 * production path — Vercel's own filesystem is read-only at runtime).
 * Otherwise falls back to writing into public/uploads/ so this works in
 * local dev, or on any host with a persistent disk, without extra setup.
 */
export async function saveUploadedImage(file: File): Promise<{ url: string }> {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new UploadError("Only PNG, JPG, WEBP, or GIF images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("Image must be smaller than 8MB.");
  }

  const filename = `${Date.now()}-${sanitizeBaseName(file.name)}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
    });
    return { url: blob.url };
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return { url: `/uploads/${filename}` };
}
