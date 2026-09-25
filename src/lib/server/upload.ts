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

/**
 * Real bug found 2026-09-24: BLOB_READ_WRITE_TOKEN was never actually configured on the live
 * Vercel deployment, so every upload silently fell through to the "local disk" fallback below --
 * which then failed with a confusing raw ENOENT (Vercel's filesystem is read-only at runtime
 * except /tmp). This made every upload-dependent feature (photo estimates, AI-generated content,
 * admin image uploads) fail in production despite working perfectly in local dev, where the disk
 * fallback is genuinely writable. Fail loudly and clearly instead of attempting a doomed write.
 */
function assertStorageAvailable() {
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new UploadError("File storage isn't connected yet -- connect Vercel Blob storage to this project (Vercel dashboard -> Storage -> Create Database -> Blob), then try again.");
  }
}

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
  assertStorageAvailable();

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return { url: `/uploads/${filename}` };
}

/**
 * Same storage strategy as saveUploadedImage (Vercel Blob when configured, else public/uploads/),
 * but for a raw server-generated buffer (an AI-generated poster from OpenAI, or a browser-
 * assembled video) rather than a File the browser uploaded directly.
 */
export async function saveGeneratedFile(buffer: Buffer, extension: string, contentType: string, baseName: string, maxBytes: number): Promise<{ url: string }> {
  if (buffer.byteLength > maxBytes) {
    throw new UploadError(`Generated file is too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB, max ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }
  const filename = `${Date.now()}-${sanitizeBaseName(baseName)}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, buffer, { access: "public", contentType, addRandomSuffix: true });
    return { url: blob.url };
  }
  assertStorageAvailable();

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), buffer);
  return { url: `/uploads/${filename}` };
}
