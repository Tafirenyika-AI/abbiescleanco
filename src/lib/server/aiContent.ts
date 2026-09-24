import { getIntegrationValue } from "./integrationSettings";
import { saveGeneratedFile, UploadError } from "./upload";
import { sniffMedia } from "./mediaUpload";
import { business } from "@/lib/data/business";

/**
 * AI content generation for Marketing Studio: real poster/flyer images via OpenAI's image
 * model. Never invents business facts -- the real name/city/tagline are the only business
 * context injected automatically; everything else (offer, style, what's pictured) comes from
 * what the admin actually typed.
 */

const MAX_POSTER_BYTES = 10 * 1024 * 1024; // 10MB -- gpt-image-1 PNG output is typically 1-4MB
const IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
export type PosterSize = (typeof IMAGE_SIZES)[number];
export { IMAGE_SIZES };

interface OpenAiImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

export async function generatePosterImage(input: { prompt: string; size?: PosterSize }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const apiKey = await getIntegrationValue("openaiApiKey", "OPENAI_API_KEY");
  if (!apiKey) return { ok: false, error: "OpenAI API key isn't configured yet. Save it under Settings → Integrations first." };

  const prompt = [
    `Professional marketing flyer/poster for ${business.name}, a residential cleaning company in ${business.city}, ${business.region}.`,
    `Clean, modern, trustworthy aesthetic in navy and teal tones. No cartoonish or low-quality look.`,
    input.prompt.trim(),
    `If the description mentions specific text (an offer, phone number, price), render it clearly and correctly spelled -- do not invent additional text or claims beyond what's described.`,
  ].join(" ");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: input.size ?? "1024x1536", n: 1 }),
  });
  const data = (await res.json().catch(() => null)) as OpenAiImageResponse | null;
  const b64 = data?.data?.[0]?.b64_json;
  if (!res.ok || !b64) {
    return { ok: false, error: data?.error?.message || "OpenAI rejected the image request." };
  }

  const buffer = Buffer.from(b64, "base64");
  try {
    const { url } = await saveGeneratedFile(buffer, "png", "image/png", "ai-poster", MAX_POSTER_BYTES);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't save the generated image." };
  }
}

const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // browser-assembled slideshow is kept short/low-bitrate specifically to stay well under this

export async function saveGeneratedVideo(buffer: Buffer): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const detected = sniffMedia(buffer);
  if (!detected || detected.kind !== "VIDEO") {
    return { ok: false, error: "That doesn't look like a real video file." };
  }
  try {
    const { url } = await saveGeneratedFile(buffer, detected.ext, detected.mime, "ai-video", MAX_VIDEO_BYTES);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof UploadError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't save the generated video." };
  }
}
