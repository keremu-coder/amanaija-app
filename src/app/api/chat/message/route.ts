import { createClient } from "@supabase/supabase-js";
import { tooMany } from "@/lib/ratelimit";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function hashIp(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

const memBuckets = new Map<string, { count: number; resetAt: number }>();

function checkMem(key: string, limit: number, windowMs: number): { ok: boolean } {
  const now = Date.now();
  if (memBuckets.size > 500) {
    for (const [k, v] of memBuckets) {
      if (v.resetAt <= now) memBuckets.delete(k);
    }
  }
  const bucket = memBuckets.get(key);
  if (bucket && bucket.resetAt > now) {
    if (bucket.count >= limit) return { ok: false };
    bucket.count += 1;
    return { ok: true };
  }
  memBuckets.set(key, { count: 1, resetAt: now + windowMs });
  return { ok: true };
}

async function checkDb(key: string, bucketName: string, limit: number, windowMs: number): Promise<{ ok: boolean }> {
  const since = new Date(Date.now() - windowMs).toISOString();
  try {
    const { count } = await supabaseAdmin
      .from("rate_events")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .eq("bucket", bucketName)
      .gte("created_at", since);

    if ((count ?? 0) >= limit) return { ok: false };
    await supabaseAdmin.from("rate_events").insert({ key, bucket: bucketName });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: Request) {
  const __limited = await tooMany(req, "chat-msg", 30, 60);
  if (__limited) return __limited;
  try {
    const { body, parent_id, client_id, user_name } = await req.json();

    if (typeof body !== "string" || !body.trim() || body.length > 500) {
      return Response.json({ error: "Invalid message body" }, { status: 400 });
    }
    if (typeof client_id !== "string" || !client_id) {
      return Response.json({ error: "Missing client_id" }, { status: 400 });
    }

    const safeUserName = String(user_name || "Guest")
      .replace(/[^\w\s\-\.]/g, "")
      .trim()
      .slice(0, 20) || "Guest";

    if (!checkMem(`client:${client_id}`, 15, 60_000)) {
      return Response.json({ error: "Slow down! Max 15 messages per minute." }, { status: 429 });
    }
    if (!(await checkDb(`client:${client_id}`, "chat_message", 15, 60_000))) {
      return Response.json({ error: "Slow down! Max 15 messages per minute." }, { status: 429 });
    }

    const ip = getIp(req);
    if (ip) {
      const ipHash = hashIp(ip);
      if (!checkMem(`ip:${ipHash}`, 25, 60_000)) {
        return Response.json({ error: "Too many messages from your network. Try again shortly." }, { status: 429 });
      }
      if (!(await checkDb(`ip:${ipHash}`, "chat_message", 25, 60_000))) {
        return Response.json({ error: "Too many messages from your network. Try again shortly." }, { status: 429 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        room_id: "aba-market",
        user_name: safeUserName,
        body: body.trim(),
        parent_id: parent_id || null,
        client_id,
      })
      .select()
      .single();

    if (error) {
      if (error.message?.includes("Rate limit")) {
        return Response.json({ error: "Slow down! Max 15 messages per minute." }, { status: 429 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, message: data });
  } catch (e: any) {
    return Response.json({ error: e.message || "Server error" }, { status: 500 });
  }
}