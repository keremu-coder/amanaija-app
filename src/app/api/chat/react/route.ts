import { adminDb, publicName, userFromReq } from "@/lib/authUser";
import { tooMany } from "@/lib/ratelimit";

const EMOJI = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]{1,8}$/u;

export async function POST(req: Request) {
  const limited = await tooMany(req, "chat-react", 40, 60);
  if (limited) return limited;
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in to speak." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const messageId = String(body.message_id || "");
  const emoji = String(body.emoji || "");
  if (!/^[0-9a-f-]{36}$/i.test(messageId) || !EMOJI.test(emoji)) {
    return Response.json({ error: "Could not add that reaction." }, { status: 400 });
  }
  const name = publicName(user);
  let { error } = await adminDb.from("message_reactions").insert({ message_id: messageId, user_name: name, user_id: user.id, emoji });
  if (error && /user_id/i.test(error.message || "")) {
    const again = await adminDb.from("message_reactions").insert({ message_id: messageId, user_name: name, emoji });
    error = again.error;
  }
  if (error && /duplicate|unique/i.test(error.message || "")) return Response.json({ ok: true });
  if (error) return Response.json({ error: "Could not add that reaction." }, { status: 400 });
  return Response.json({ ok: true });
}
