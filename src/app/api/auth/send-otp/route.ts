import { createClient } from "@supabase/supabase-js";
import { tooMany } from "@/lib/ratelimit";
import { normalizePhone, hashCode, newCode } from "@/lib/otp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  const __limited = await tooMany(req, "otp-send", 8, 600);
  if (__limited) return __limited;
  try {
    const body = await req.json().catch(() => ({}));
    const phone = (body as any)?.phone;
    if (typeof phone !== "string") {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      return Response.json({ error: "Enter a valid Nigerian phone number" }, { status: 400 });
    }

    const now = Date.now();

    // Per-phone limits: max 3 codes in 10 minutes, at least 60 seconds apart
    const { data: recent } = await supabaseAdmin
      .from("otp_codes")
      .select("created_at")
      .eq("phone", cleanPhone)
      .gt("created_at", new Date(now - 10 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });
    if (recent && recent.length >= 3) {
      return Response.json({ error: "Too many codes requested. Try again in 10 minutes." }, { status: 429 });
    }
    if (recent && recent[0] && now - new Date(recent[0].created_at).getTime() < 60 * 1000) {
      return Response.json({ error: "Please wait a minute before asking for another code." }, { status: 429 });
    }

    // Daily SMS budget guard for the whole platform
    const cap = Number(process.env.OTP_DAILY_CAP || 500);
    const { count } = await supabaseAdmin
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .gt("created_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());
    if ((count || 0) >= cap) {
      console.error("OTP daily cap reached");
      return Response.json({ error: "Verification is temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const code = newCode();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();
    const { data: row, error: insErr } = await supabaseAdmin
      .from("otp_codes")
      .insert({ phone: cleanPhone, code: hashCode(cleanPhone, code), expires_at: expiresAt })
      .select("id")
      .single();
    if (insErr || !row) {
      console.error("OTP insert error:", insErr);
      return Response.json({ error: "Could not send the code. Please try again." }, { status: 500 });
    }

    const termiiRes = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TERMII_API_KEY,
        to: cleanPhone,
        from: "N-Alert",
        sms: `Your AmaNaija verification code is ${code}. Valid for 5 minutes. Never share it.`,
        type: "plain",
        channel: "generic",
      }),
    });

    if (!termiiRes.ok) {
      const termiiData = await termiiRes.json().catch(() => ({}));
      console.error("Termii error:", termiiData);
      await supabaseAdmin.from("otp_codes").delete().eq("id", row.id);
      return Response.json({ error: "Could not send the SMS. Please try again." }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (err: any) {
    console.error("send-otp error:", err?.message);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}