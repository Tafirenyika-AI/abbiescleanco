import crypto from "crypto";

/**
 * TOTP (RFC 6238) implemented directly on Node's crypto — no extra
 * dependency for something this small and security-sensitive; easier to
 * audit than trusting a third-party package for it.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;

export function generateSecret(): string {
  const bytes = crypto.randomBytes(20); // 160 bits, standard TOTP secret size
  return base32Encode(bytes);
}

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

export function generateTotp(secret: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(secret, counter);
}

/** Accepts the current and one adjacent 30s window either side, to tolerate clock drift. */
export function verifyTotp(secret: string, token: string, at: number = Date.now()): boolean {
  const clean = token.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    if (hotp(secret, counter + drift) === clean) return true;
  }
  return false;
}

export function generateOtpAuthUrl(secret: string, accountEmail: string, issuer = "Abbie's Clean Method"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(CODE_DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Formats a secret in 4-char groups for easier manual entry into an authenticator app. */
export function formatSecretForDisplay(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex").toUpperCase());
}
