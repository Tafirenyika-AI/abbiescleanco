import crypto from "crypto";
import { getIntegrationValue } from "@/lib/server/integrationSettings";

// Ed25519 SubjectPublicKeyInfo DER prefix -- Telnyx's portal gives you the raw 32-byte public key
// (base64), and Node's crypto.createPublicKey needs it wrapped in this fixed ASN.1 SPKI header to
// import it. This is Telnyx's own documented Node.js verification approach as of this writing;
// reverify against Telnyx's current webhook signing docs before relying on this in production, in
// case their payload/header format has changed.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Telnyx signs webhooks with Ed25519: headers `telnyx-signature-ed25519` (base64 signature) and
 * `telnyx-timestamp` (unix seconds), signing the string `${timestamp}|${rawBody}`. Verify against
 * the account's public key (Settings -> Integrations -> Telnyx Public Key), never a shared secret.
 */
export async function verifyTelnyxSignature(rawBody: string, signatureHeader: string | null, timestampHeader: string | null): Promise<boolean> {
  const publicKeyBase64 = await getIntegrationValue("telnyxPublicKey", "TELNYX_PUBLIC_KEY");
  if (!publicKeyBase64 || !signatureHeader || !timestampHeader) return false;

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false; // replay protection -- reject stale or clock-skewed deliveries
  }

  try {
    const rawPublicKey = Buffer.from(publicKeyBase64, "base64");
    const derKey = Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]);
    const keyObject = crypto.createPublicKey({ key: derKey, format: "der", type: "spki" });
    const signedPayload = Buffer.from(`${timestampHeader}|${rawBody}`);
    const signature = Buffer.from(signatureHeader, "base64");
    return crypto.verify(null, signedPayload, keyObject, signature);
  } catch {
    return false;
  }
}
