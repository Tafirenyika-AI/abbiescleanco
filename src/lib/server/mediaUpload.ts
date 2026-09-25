import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

export class MediaError extends Error {}

/** Same real bug/fix as upload.ts's assertStorageAvailable() -- see its comment for the full story. */
function assertStorageAvailable() {
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new MediaError("File storage isn't connected yet. Please try again shortly.");
  }
}

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // voice notes are short -- well under video's cap

export type DetectedMedia = { kind: "IMAGE" | "VIDEO" | "AUDIO"; mime: string; ext: string };

/** Identify a file by its magic bytes -- the browser-supplied MIME type / extension is never trusted. */
export function sniffMedia(buf: Buffer): DetectedMedia | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "IMAGE", mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "IMAGE", mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { kind: "IMAGE", mime: "image/webp", ext: "webp" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WAVE") return { kind: "AUDIO", mime: "audio/wav", ext: "wav" };
  if (buf.subarray(0, 4).toString("ascii") === "OggS") return { kind: "AUDIO", mime: "audio/ogg", ext: "ogg" };
  if (buf.subarray(0, 3).toString("ascii") === "ID3") return { kind: "AUDIO", mime: "audio/mpeg", ext: "mp3" };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { kind: "AUDIO", mime: "audio/mpeg", ext: "mp3" }; // raw MPEG frame sync, no ID3 tag
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (/^(heic|heix|hevc|mif1|msf1)/.test(brand)) return { kind: "IMAGE", mime: "image/heic", ext: "heic" };
    if (brand === "qt  ") return { kind: "VIDEO", mime: "video/quicktime", ext: "mov" };
    if (brand === "M4A ") return { kind: "AUDIO", mime: "audio/mp4", ext: "m4a" }; // Apple's audio-only MPEG-4 brand, distinct from video's isom/mp42
    return { kind: "VIDEO", mime: "video/mp4", ext: "mp4" };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { kind: "VIDEO", mime: "video/webm", ext: "webm" };
  return null;
}

async function storeBuffer(buf: Buffer, ext: string, contentType: string): Promise<string> {
  const filename = `${randomUUID().replace(/-/g, "")}.${ext}`; // 128 bits of randomness -- unguessable URL
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`client-media/${filename}`, buf, { access: "public", contentType, addRandomSuffix: true });
    return blob.url;
  }
  assertStorageAvailable();
  const dir = path.join(process.cwd(), "public", "uploads", "client");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buf);
  return `/api/uploads/client/${filename}`;
}

export interface SavedMedia {
  url: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO";
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates and stores a customer-provided photo, video, or voice note. Images are re-encoded
 * (auto-rotated, downscaled, and stripped of EXIF -- including GPS coordinates of the customer's
 * home). Video and audio are stored as-is once their magic bytes are verified.
 */
export async function saveCustomerMedia(file: File): Promise<SavedMedia> {
  if (file.size === 0) throw new MediaError("That file is empty.");
  if (file.size > MAX_VIDEO_BYTES) throw new MediaError("File is too large (max 60MB for video, 15MB for a voice note, 12MB for photos).");
  const buf = Buffer.from(await file.arrayBuffer());
  const detected = sniffMedia(buf);
  if (!detected) throw new MediaError("Unsupported file. Please upload a JPG, PNG, WEBP or HEIC photo, an MP4, MOV or WEBM video, or a WAV, MP3, OGG or M4A voice note.");

  if (detected.kind === "IMAGE") {
    if (file.size > MAX_IMAGE_BYTES) throw new MediaError("Photo is too large (max 12MB).");
    let out: Buffer;
    try {
      out = await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    } catch {
      throw new MediaError("We couldn't read that photo. Try a JPG or PNG.");
    }
    return { url: await storeBuffer(out, "jpg", "image/jpeg"), kind: "IMAGE", mimeType: "image/jpeg", sizeBytes: out.length };
  }

  if (detected.kind === "AUDIO" && file.size > MAX_AUDIO_BYTES) throw new MediaError("Voice note is too large (max 15MB).");

  return { url: await storeBuffer(buf, detected.ext, detected.mime), kind: detected.kind, mimeType: detected.mime, sizeBytes: buf.length };
}

/** Bytes of a normalized JPEG for sending to a vision model (already validated upstream). */
export async function prepareImageForAnalysis(file: File): Promise<{ base64: string; buffer: Buffer } | null> {
  const buf = Buffer.from(await file.arrayBuffer());
  const detected = sniffMedia(buf);
  if (!detected || detected.kind !== "IMAGE") return null;
  const out = await sharp(buf).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return { base64: out.toString("base64"), buffer: out };
}

/** URLs we'll accept as already-uploaded media (guards against pointing an attachment at an arbitrary site). */
export function isTrustedMediaUrl(url: string): boolean {
  if (/^\/api\/uploads\/client\/[a-f0-9]{32}\.(jpg|png|webp|mp4|mov|webm|wav|mp3|ogg|m4a)$/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
