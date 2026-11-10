import { adminDb, userIdFromReq } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const limited = await tooMany(req, "push-sub", 20, 600);
  if (limited) return limited;
  const uid = await userIdFromReq(req);
  if (!uid) return Response.json({ error: "Please log in" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const endpoint = String(b?.endpoint || "");
  const apns = /^apns:[A-Fa-f0-9]{16,200}$/.test(endpoint);
  if (endpoint.length > 600 || (!apns && !/^https:\/\//.test(endpoint))) return Response.json({ error: "Bad subscription" }, { status: 400 });
  await adminDb.from("push_subscriptions").upsert({ endpoint, user_id: uid });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await userIdFromReq(req);
  if (!uid) return Response.json({ error: "Please log in" }, { status: 401 });
  await adminDb.from("push_subscriptions").delete().eq("user_id", uid);
  return Response.json({ ok: true });
}
