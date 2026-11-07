import { adminDb, userIdFromReq } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";
import { sendPushTo } from "@/lib/webpush";

// Called right after someone sends a message. The server works out who should be alerted and checks the sender really messaged them.
export async function POST(req: Request) {
  const limited = await tooMany(req, "push-notify", 40, 600);
  if (limited) return limited;
  const uid = await userIdFromReq(req);
  if (!uid) return Response.json({ error: "Please log in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  let to: string | null = null;
  if (b.request_id) {
    const { data: r } = await adminDb.from("dm_requests").select("from_id,to_id,status").eq("id", String(b.request_id)).maybeSingle();
    if (r && (r.from_id === uid || r.to_id === uid)) to = r.from_id === uid ? r.to_id : r.from_id;
  } else {
    let target: string | null = null;
    if (b.slug) {
      const { data: l } = await adminDb.from("listings").select("seller_id").eq("slug", String(b.slug)).maybeSingle();
      target = l?.seller_id || null;
    } else if (b.hid) {
      const { data: h } = await adminDb.from("hawkers").select("user_id").eq("id", String(b.hid)).maybeSingle();
      target = h?.user_id || null;
    } else if (b.to) target = String(b.to);
    if (target) {
      const { data: r } = await adminDb.from("dm_requests").select("id").eq("from_id", uid).eq("to_id", target).gt("created_at", new Date(Date.now() - 120000).toISOString()).maybeSingle();
      if (r) to = target;
    }
  }
  if (to && to !== uid) await sendPushTo(to);
  return Response.json({ ok: true });
}
