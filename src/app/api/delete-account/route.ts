import { NextResponse } from 'next/server';
import { tooMany } from "@/lib/ratelimit";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// A person can only delete their OWN account, proven by their login token.
export async function POST(req: Request) {
  const __limited = await tooMany(req, "del-acct", 5, 600);
  if (__limited) return __limited;
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
    }

    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) {
      return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('delete-account error:', error?.message);
    return NextResponse.json({ error: 'Could not delete the account.' }, { status: 500 });
  }
}