import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { userIdFromReq } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  const limited = await tooMany(req, "track-ip", 30, 60);
  if (limited) return limited;
  try {
    // Who is calling is proven by their login token, never by a field they send.
    const uid = await userIdFromReq(req);
    
    // Get the IP from Vercel headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown";
    
    // Hash the IP for privacy (NDPA compliant)
    const salt = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const ipHash = crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);

    // Check if this IP is already banned
    const { data: isBanned } = await supabaseAdmin.rpc("check_ip_ban", { p_ip_hash: ipHash });
    
    if (isBanned) {
      return Response.json({ error: "Your network has been banned for violating our terms." }, { status: 403 });
    }

    // Save the IP hash to their profile
    if (uid) {
      await supabaseAdmin.from("profiles").update({ ip_hash: ipHash }).eq("id", uid);
    }

    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}