import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

// Returns a 429 Response when the caller is over the limit, otherwise null.
// Fails open if the limiter itself is unavailable, so a database hiccup never takes the site down.
export async function tooMany(req: Request, name: string, limit: number, windowSec: number): Promise<Response | null> {
  try {
    const { data, error } = await admin.rpc("rate_hit", { p_key: `${name}:${clientIp(req)}`, p_limit: limit, p_window_sec: windowSec });
    if (error) return null;
    if (data === false) {
      return Response.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429, headers: { "Retry-After": String(windowSec) } });
    }
  } catch {}
  return null;
}
