import crypto from "crypto";
import { adminDb } from "@/lib/authUser";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

// Sends a "you have a message" alert. It carries no private text, so nothing readable travels through the push services.
export async function sendPushTo(userId: string): Promise<void> {
  const jwkRaw = process.env.VAPID_PRIVATE_JWK, pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
  if (!jwkRaw || !pub) return;
  const key = crypto.createPrivateKey({ key: JSON.parse(jwkRaw), format: "jwk" });
  const { data: subs } = await adminDb.from("push_subscriptions").select("endpoint").eq("user_id", userId).limit(5);
  await Promise.all((subs || []).map(async (s: { endpoint: string }) => {
    try {
      const aud = new URL(s.endpoint).origin;
      const head = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
      const body = b64(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:support@amanaija.vercel.app" }));
      const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
      const r = await fetch(s.endpoint, { method: "POST", headers: { Authorization: `vapid t=${head}.${body}.${b64(sig)}, k=${pub}`, TTL: "86400", Urgency: "normal", "Content-Length": "0" } });
      if (r.status === 404 || r.status === 410) await adminDb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    } catch {}
  }));
}
