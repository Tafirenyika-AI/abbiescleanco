import { randomUUID } from "crypto";
import { prisma, isDatabaseConfigured } from "@/lib/db";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export class UploadError extends Error {}

/**
 * Real bug found 2026-09-24: Vercel Blob was never actually connected in production, so every
 * upload silently fell through to a "local disk" fallback -- which fails on Vercel's read-only
 * filesystem. Rather than depend on Vercel Blob (or its dashboard, which showed the token as
 * connected when it genuinely wasn't reaching the runtime), uploaded/generated files are stored
 * as rows in the database instead -- the one piece of infrastructure this app already trusts and
 * that works identically in every environment.
 */
async function storeInDb(buffer: Buffer, contentType: string): Promise<string> {
  if (!isDatabaseConfigured || !prisma) {
    throw new UploadError("Storage isn't available right now -- the database isn't configured.");
  }
  const id = randomUUID().replace(/-/g, "");
  await prisma.storedFile.create({ data: { id, contentType, data: new Uint8Array(buffer), size: buffer.length } });
  return `/api/files/${id}`;
}

/**
 * Stores an admin-uploaded image and returns a public URL for it.
 */
export async function saveUploadedImage(file: File): Promise<{ url: string }> {
  if (!ALLOWED_TYPES[file.type]) {
    throw new UploadError("Only PNG, JPG, WEBP, or GIF images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("Image must be smaller than 8MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { url: await storeInDb(buffer, file.type) };
}

/**
 * Same storage strategy as saveUploadedImage, but for a raw server-generated buffer (an
 * AI-generated poster from OpenAI, or a browser-assembled video) rather than a File the browser
 * uploaded directly.
 */
export async function saveGeneratedFile(buffer: Buffer, contentType: string, maxBytes: number): Promise<{ url: string }> {
  if (buffer.byteLength > maxBytes) {
    throw new UploadError(`Generated file is too large (${Math.round(buffer.byteLength / 1024 / 1024)}MB, max ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }
  return { url: await storeInDb(buffer, contentType) };
}
