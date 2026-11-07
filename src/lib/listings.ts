import crypto from "crypto";

export const CATEGORIES = ["Phones and tablets", "Computers", "Electronics", "Home and furniture", "Appliances", "Fashion", "Baby and kids", "Vehicles and parts", "Sports and fitness", "Books", "Other"];

export const CONDITIONS: Record<string, string> = {
  new: "Brand new, unused",
  open_box: "Open box, never used",
  like_new: "Used a few times, like new",
  used_good: "Used, good condition",
  used_fair: "Used, fair condition",
};

export const PHONE_RE = /\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d/;
export const OUTSIDE_RE = /whats\s?app|telegram|call me|dm me|text me|send money first|pay first|advance payment|part payment first|bank transfer first/i;
export const BANNED_RE = /\b(gun|pistol|rifle|ammunition|cocaine|heroin|weed|marijuana|tramadol|codeine|human organ|passport|visa|atm card|bvn|cvv|sim card|stolen|counterfeit|replica|clone card|hacked)\b/i;

export function composeDescription(f: { title: string; condition: string; included: string; faults: string; reason: string; extra: string }): string {
  const lines = [
    `${f.title}. Condition: ${CONDITIONS[f.condition] || f.condition}.`,
    `Included: ${f.included}.`,
    `Known faults: ${f.faults}.`,
    `Reason for selling: ${f.reason}.`,
  ];
  if (f.extra) lines.push(f.extra);
  lines.push("Meet in a public place, inspect the item before you pay, and never pay in advance.");
  return lines.join("\n");
}

// A short code the seller writes on paper and photographs next to the item. Valid today and yesterday.
export function proofCodeFor(uid: string, daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  const h = crypto.createHmac("sha256", process.env.PROOF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "x").update(`${uid}:${d}`).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, "0");
}

export function newSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.randomBytes(8);
  return Array.from(b, (x) => chars[x % chars.length]).join("");
}

export function publicPhoto(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${path}`;
}
