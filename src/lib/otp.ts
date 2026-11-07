import crypto from "crypto";

// Normalise a Nigerian number to 234XXXXXXXXXX, or null if it is not valid.
export function normalizePhone(raw: string): string | null {
  let p = String(raw || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "234" + p.slice(1);
  else if (!p.startsWith("234")) p = "234" + p;
  return /^234\d{10}$/.test(p) ? p : null;
}

// Codes are stored only as a keyed hash, never as plain text.
export function hashCode(phone: string, code: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return crypto.createHmac("sha256", pepper).update(`${phone}:${code}`).digest("hex");
}

export function newCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}