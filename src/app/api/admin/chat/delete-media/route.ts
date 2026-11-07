import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    // Who is asking? Proven by their login token, never by an email in the request.
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return Response.json({ error: "Not authorized" }, { status: 401 });

    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !auth?.user) return Response.json({ error: "Not authorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.is_admin) return Response.json({ error: "Not authorized" }, { status: 403 });

    const body: any = await req.json().catch(() => ({}));
    const messageId = body?.messageId;
    if (!messageId) return Response.json({ error: "messageId required" }, { status: 400 });

    const { data: msg } = await supabaseAdmin.from("messages").select("media_url").eq("id", messageId).maybeSingle();

    if (msg?.media_url && msg.media_url.startsWith("/api/chat/media/")) {
      const filename = msg.media_url.replace("/api/chat/media/", "");
      if (/^[A-Za-z0-9._-]+$/.test(filename)) {
        await supabaseAdmin.storage.from("chat-media").remove([`chat/aba-market/${filename}`]);
      }
    }

    const { error } = await supabaseAdmin.from("messages").delete().eq("id", messageId);
    if (error) return Response.json({ error: "Delete failed" }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("admin delete-media error:", e?.message);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}