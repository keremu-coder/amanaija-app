import { createClient, type User } from "@supabase/supabase-js";

export const adminDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export function publicName(user: { id: string; email?: string | null }): string {
  const front = String(user.email || "Member").split("@")[0].replace(/[^\w\s\-\.]/g, "").trim().slice(0, 14) || "Member";
  const tail = user.id.replace(/-/g, "").slice(0, 4);
  return `${front}-${tail}`.slice(0, 20);
}

export async function userFromReq(req: Request): Promise<User | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const { data, error } = await adminDb.auth.getUser(t);
  if (error || !data.user) return null;
  return data.user;
}

// Returns the signed-in user's id from the Bearer token, or null.
export async function userIdFromReq(req: Request): Promise<string | null> {
  const user = await userFromReq(req);
  return user?.id || null;
}
