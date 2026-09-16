/**
 * Minimal in-memory sliding-window rate limiter, keyed by client IP.
 * Good enough for a single Node process; on Vercel's serverless/edge
 * runtime this resets per instance, so for production scale swap this for
 * a durable store (e.g. Upstash Redis) behind the same `checkRateLimit`
 * signature — nothing calling it needs to change.
 */
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs?: number } {
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
