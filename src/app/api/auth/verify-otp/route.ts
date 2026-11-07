import crypto from "crypto";
import { tooMany } from "@/lib/ratelimit";
import { createClient } from "@supabase/supabase-js";
import { normalizePhone, hashCode } from "@/lib/otp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const __limited = await tooMany(req, "otp-verify", 20, 600);
  if (__limited) return __limited;
  try {
    const body = await req.json().catch(() => ({}));
    const phone = (body as any)?.phone;
    const code = (body as any)?.code;
    const cleanPhone = typeof phone === "string" ? normalizePhone(phone) : null;
    if (!cleanPhone || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return Response.json({ error: "Invalid or expired OTP code" }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", cleanPhone)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return Response.json({ error: "Invalid or expired OTP code" }, { status: 400 });
    }

    const attempts = Number((data as any).attempts || 0);
    if (attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("otp_codes").delete().eq("id", data.id);
      return Response.json({ error: "Too many wrong attempts. Please request a new code." }, { status: 429 });
    }

    const expected = Buffer.from(hashCode(cleanPhone, code), "hex");
    const actual = Buffer.from(String(data.code), "hex");
    const match = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);

    if (!match) {
      await supabaseAdmin.from("otp_codes").update({ attempts: attempts + 1 }).eq("id", data.id);
      return Response.json({ error: "Invalid or expired OTP code" }, { status: 400 });
    }

    await supabaseAdmin.from("otp_codes").delete().eq("id", data.id);

    // Remember, on the server, that this phone passed the check (used by create_order)
    await supabaseAdmin
      .from("verified_phones")
      .upsert({ phone: cleanPhone, verified_at: new Date().toISOString() });

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("verify-otp error:", err?.message);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
