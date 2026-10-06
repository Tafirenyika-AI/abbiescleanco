/**
 * US-focused E.164 normalizer. This business only operates in the US, so a bare 10-digit number is
 * assumed to be a US number; anything already starting with "+" is trusted as-is. Returns null for
 * input that can't be confidently normalized, rather than guessing.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
