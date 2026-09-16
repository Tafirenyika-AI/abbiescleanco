/** Generates a human-friendly, sortable reference like ACM-26-4F3A9C. */
export function generateReference(prefix = "ACM"): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${year}-${random}`;
}
