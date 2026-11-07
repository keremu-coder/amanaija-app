import crypto from "crypto";
import { adminDb } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";

// Receives crash reports from the app. Anonymous, rate limited, no personal data: just the error, the page and the device type.
export async function POST(req: Request) {
  const limited = await tooMany(req, "log-error", 20, 600);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const message = String(b?.message || "").slice(0, 300);
  if (!message) return Response.json({ ok: true });
  const stack = String(b?.stack || "").slice(0, 1500);
  const page = String(b?.page || "").replace(/[?#].*$/, "").slice(0, 120);
  const ua = req.headers.get("user-agent") || "";
  const device = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : "Desktop";
  const fp = crypto.createHash("sha1").update(`${message}|${page}|${device}`).digest("hex");
  const { data: ex } = await adminDb.from("app_errors").select("id,count").eq("fp", fp).maybeSingle();
  if (ex) await adminDb.from("app_errors").update({ count: ex.count + 1, created_at: new Date().toISOString() }).eq("id", ex.id);
  else await adminDb.from("app_errors").insert({ message, stack, page, device, fp });
  return Response.json({ ok: true });
}
