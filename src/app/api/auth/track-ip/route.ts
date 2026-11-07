import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    
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
    if (email) {
      await supabaseAdmin.from("profiles").update({ ip_hash: ipHash }).eq("email", email);
    }

    return Response.json({ ok: true, ipHash });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}