"use client";

/**
 * Assembles a short vertical "promo video" (Ken Burns pan/zoom slideshow + a text overlay bar)
 * entirely in the browser, using Canvas 2D + MediaRecorder -- no server-side video encoding
 * (no ffmpeg, no serverless duration/size limits, no extra API/cost). Deliberately not "true"
 * AI-generated video; this is real, automated content assembly from real images, which is what
 * most social schedulers mean by "turn these photos into a video ad" anyway.
 *
 * Kept short/low-bitrate on purpose so the resulting file comfortably fits Vercel's ~4.5MB
 * serverless request body limit for the plain multipart upload this feeds into.
 */

const WIDTH = 720;
const HEIGHT = 1280;
const SECONDS_PER_IMAGE = 3;
const FPS = 30;
const BITRATE = 1_500_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load image for the video: ${url}`));
    img.src = url;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
}

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

export async function assembleSlideshowVideo(imageUrls: string[], overlayText: string): Promise<Blob> {
  if (imageUrls.length === 0) throw new Error("Add at least one image first.");
  if (typeof MediaRecorder === "undefined") throw new Error("This browser doesn't support video recording (MediaRecorder). Try a recent Chrome or Edge.");

  const images = await Promise.all(imageUrls.map(loadImage));

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a canvas to render the video.");

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: pickMimeType(), videoBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();

  const totalDurationMs = images.length * SECONDS_PER_IMAGE * 1000;
  await new Promise<void>((resolve) => {
    const start = performance.now();
    function draw(now: number) {
      const elapsed = now - start;
      if (elapsed >= totalDurationMs) { resolve(); return; }

      const imgIndex = Math.min(images.length - 1, Math.floor(elapsed / (SECONDS_PER_IMAGE * 1000)));
      const img = images[imgIndex];
      const localT = (elapsed - imgIndex * SECONDS_PER_IMAGE * 1000) / (SECONDS_PER_IMAGE * 1000);
      const scale = 1.08 - 0.08 * localT; // slow zoom-out, a classic Ken Burns feel

      ctx!.fillStyle = "#0f1f2e";
      ctx!.fillRect(0, 0, WIDTH, HEIGHT);

      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = WIDTH / HEIGHT;
      let drawW: number, drawH: number;
      if (imgRatio > canvasRatio) { drawH = HEIGHT * scale; drawW = drawH * imgRatio; } else { drawW = WIDTH * scale; drawH = drawW / imgRatio; }
      ctx!.drawImage(img, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);

      if (overlayText) {
        const barHeight = 150;
        ctx!.fillStyle = "rgba(15, 31, 46, 0.72)";
        ctx!.fillRect(0, HEIGHT - barHeight, WIDTH, barHeight);
        ctx!.fillStyle = "#ffffff";
        ctx!.font = "600 34px system-ui, sans-serif";
        ctx!.textAlign = "center";
        wrapText(ctx!, overlayText, WIDTH / 2, HEIGHT - barHeight / 2, WIDTH - 80, 42);
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  });

  recorder.stop();
  return stopped;
}
