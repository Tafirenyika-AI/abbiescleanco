import { getIntegrationValue } from "@/lib/server/integrationSettings";

/**
 * Fixed-window rate limiter, keyed by an arbitrary caller-supplied key (usually
 * `<route>:<ip>` or `<route>:<userId>`). Two backends behind the same signature:
 *
 * - In-memory (default, no setup needed): good enough for a single Node process.
 *   On serverless/edge, this resets per instance, so it's not durable across
 *   restarts or shared across concurrent instances -- fine for a small site,
 *   not a hard security boundary on its own (this app also has magic-byte
 *   upload validation, a honeypot field, proxy-level auth, etc.).
 * - Upstash Redis (once UPSTASH_REDIS_REST_URL/TOKEN are set in Settings or
 *   env), via its REST API so no persistent TCP connection is needed from a
 *   serverless function: durable and shared across instances. Uses a simple
 *   INCR + EXPIRE NX fixed window rather than a true sliding window -- it can
 *   allow marginally more than `limit` right at a window boundary, which is an
 *   accepted, standard tradeoff for how much simpler and cheaper it is.
 */
const hits = new Map<string, number[]>();

function checkInMemory(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const existing = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (existing.length >= limit) {
    const retryAfterMs = existing[0] + windowMs - now;
    hits.set(key, existing);
    return { allowed: false, retryAfterMs };
  }

  existing.push(now);
  hits.set(key, existing);
  return { allowed: true };
}

interface UpstashResult {
  result: number | null;
}

async function checkUpstash(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs?: number } | null> {
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `ratelimit:${key}`;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(ttlSeconds), "NX"],
        ["PTTL", redisKey],
      ]),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null; // fall back to in-memory rather than fail the request
    const [incrRes, , pttlRes] = (await res.json()) as UpstashResult[];
    const count = incrRes.result ?? 1;
    if (count > limit) {
      const retryAfterMs = typeof pttlRes?.result === "number" && pttlRes.result > 0 ? pttlRes.result : windowMs;
      return { allowed: false, retryAfterMs };
    }
    return { allowed: true };
  } catch {
    return null; // Upstash unreachable -- fall back to in-memory rather than fail the request
  }
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const url = await getIntegrationValue("upstashRedisUrl", "UPSTASH_REDIS_REST_URL");
  const token = await getIntegrationValue("upstashRedisToken", "UPSTASH_REDIS_REST_TOKEN");
  if (url && token) {
    const result = await checkUpstash(url, token, key, limit, windowMs);
    if (result) return result;
  }
  return checkInMemory(key, limit, windowMs);
}
