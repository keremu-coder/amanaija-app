import { userIdFromReq } from "@/lib/authUser";
import { proofCodeFor } from "@/lib/listings";

export async function GET(req: Request) {
  const uid = await userIdFromReq(req);
  if (!uid) return Response.json({ error: "Please log in" }, { status: 401 });
  return Response.json({ code: proofCodeFor(uid) });
}
