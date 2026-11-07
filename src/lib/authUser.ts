import { createClient } from "@supabase/supabase-js";

export const adminDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Returns the signed-in user's id from the Bearer token, or null.
export async function userIdFromReq(req: Request): Promise<string | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!t) return null;
  const { data, error } = await adminDb.auth.getUser(t);
  if (error || !data.user) return null;
  return data.user.id;
}
