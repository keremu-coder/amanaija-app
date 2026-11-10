import crypto from "crypto";
import http2 from "node:http2";
import { adminDb } from "@/lib/authUser";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export async function sendPushTo(userId: string): Promise<void> {
  const { data: subs } = await adminDb.from("push_subscriptions").select("endpoint").eq("user_id", userId).limit(5);
  await Promise.all((subs || []).map(async (s: { endpoint: string }) => {
    if (s.endpoint.startsWith("apns:")) return sendApns(s.endpoint.slice(5));
    return sendWeb(s.endpoint);
  }));
}

function sendApns(device: string): Promise<void> {
  const keyPem = process.env.APNS_PRIVATE_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const team = process.env.APNS_TEAM_ID;
  if (!keyPem || !keyId || !team || !/^[A-Fa-f0-9]+$/.test(device)) return Promise.resolve();
  const key = crypto.createPrivateKey(keyPem.replace(/\\n/g, "\n"));
  const head = b64(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claim = b64(JSON.stringify({ iss: team, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${claim}`), { key, dsaEncoding: "ieee-p1363" });
  const jwt = `${head}.${claim}.${b64(sig)}`;
  const host = process.env.APNS_ENV === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    const done = () => { try { client.close(); } catch {} resolve(); };
    client.on("error", done);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${device}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": "com.amanaija.app",
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    req.on("response", (headers) => {
      const status = Number(headers[":status"] || 0);
      if (status === 410 || status === 400) adminDb.from("push_subscriptions").delete().eq("endpoint", `apns:${device}`);
    });
    req.on("error", done);
    req.on("end", done);
    req.end(JSON.stringify({ aps: { alert: { title: "AmaNaija", body: "You have a new message" }, sound: "default" } }));
  });
}

async function sendWeb(endpoint: string): Promise<void> {
  const jwkRaw = process.env.VAPID_PRIVATE_JWK, pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
  if (!jwkRaw || !pub) return;
  try {
    const key = crypto.createPrivateKey({ key: JSON.parse(jwkRaw), format: "jwk" });
    const aud = new URL(endpoint).origin;
    const head = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
    const body = b64(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:support@amanaija.vercel.app" }));
    const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
    const r = await fetch(endpoint, { method: "POST", headers: { Authorization: `vapid t=${head}.${body}.${b64(sig)}, k=${pub}`, TTL: "86400", Urgency: "normal", "Content-Length": "0" } });
    if (r.status === 404 || r.status === 410) await adminDb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {}
}
